import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'node:fs';

// FCM HTTP v1 (data-only). 서비스계정 없으면 스킵.
// Env: FIREBASE_SERVICE_ACCOUNT = 서비스계정 JSON 인라인 (또는 경로 FIREBASE_SERVICE_ACCOUNT_PATH)
type ServiceAccount = { project_id: string; client_email: string; private_key: string };

function loadAccount(): ServiceAccount | null {
  try {
    const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
    const raw = inline ?? (process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8')
      : null);
    if (!raw) return null;
    const j = JSON.parse(raw) as ServiceAccount;
    if (!j.project_id || !j.client_email || !j.private_key) return null;
    return j;
  } catch {
    return null;
  }
}

let cachedToken: { token: string; exp: number } | null = null;

async function accessToken(acct: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const auth = new GoogleAuth({
    credentials: { client_email: acct.client_email, private_key: acct.private_key },
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  const token = t.token;
  if (!token) throw new Error('no access token');
  cachedToken = { token, exp: Date.now() + 50 * 60_000 };
  return token;
}

export async function sendFcmInvite(
  fcmToken: string,
  data: { roomId: string; from: string; fromUserId?: string },
): Promise<boolean> {
  const acct = loadAccount();
  if (!acct) {
    console.log('[push] FCM skipped (no service account)');
    return false;
  }
  try {
    const at = await accessToken(acct);
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${acct.project_id}/messages:send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            data: { kind: 'call-invite', roomId: data.roomId, from: data.from, fromUserId: data.fromUserId ?? '' },
            android: { priority: 'high' },
          },
        }),
      },
    );
    if (!res.ok) {
      console.log('[push] FCM failed', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.log('[push] FCM error', String(e));
    return false;
  }
}
