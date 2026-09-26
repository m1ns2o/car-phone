import { createSign } from 'node:crypto';
import { connect, ClientHttp2Session } from 'node:http2';

// APNs HTTP/2 토큰 인증 (일반 푸시 — PushKit/CallKit 아님. 탭해서 입장).
// Env: APNS_KEY (p8 인라인), APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE=com.carphone.app, APNS_PRODUCTION=1
function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let providerToken: { token: string; iat: number } | null = null;

function getProviderToken(): string | null {
  const key = process.env.APNS_KEY?.replace(/\\n/g, '\n');
  const kid = process.env.APNS_KEY_ID;
  const team = process.env.APNS_TEAM_ID;
  if (!key || !kid || !team) return null;
  const now = Math.floor(Date.now() / 1000);
  if (providerToken && now - providerToken.iat < 50 * 60) return providerToken.token;
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'ES256', kid })));
  const payload = b64url(Buffer.from(JSON.stringify({ iss: team, iat: now })));
  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);
  const sig = b64url(signer.sign(key));
  const token = `${header}.${payload}.${sig}`;
  providerToken = { token, iat: now };
  return token;
}

let session: ClientHttp2Session | null = null;
function getSession(host: string): ClientHttp2Session {
  if (!session || session.destroyed) {
    session = connect(`https://${host}`);
    session.on('error', () => {
      try { session?.destroy(); } catch { /* ignore */ }
      session = null;
    });
  }
  return session;
}

export async function sendApnsInvite(
  deviceToken: string,
  data: { roomId: string; from: string; fromUserId?: string },
): Promise<boolean> {
  const provider = getProviderToken();
  const bundle = process.env.APNS_BUNDLE ?? 'com.carphone.app';
  if (!provider) {
    console.log('[push] APNs skipped (no p8 key)');
    return false;
  }
  const prod = process.env.APNS_PRODUCTION === '1';
  const host = prod ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
  const payload = JSON.stringify({
    aps: {
      alert: { title: '수신 통화', body: `${data.from}님이 통화를 요청합니다` },
      sound: 'default',
      category: 'INCOMING_CALL',
      'thread-id': `call-${data.roomId}`,
    },
    roomId: data.roomId,
    from: data.from,
    fromUserId: data.fromUserId ?? '',
  });
  return new Promise((resolve) => {
    try {
      const s = getSession(host);
      const req = s.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${provider}`,
        'apns-topic': bundle,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
      });
      req.setTimeout(10_000, () => {
        req.close();
        resolve(false);
      });
      req.on('response', (headers) => {
        const status = headers[':status'];
        let body = '';
        req.on('data', (c) => { body += c.toString(); });
        req.on('end', () => {
          if (status !== 200) console.log('[push] APNs failed', status, body.slice(0, 200));
          resolve(status === 200);
        });
      });
      req.on('error', (e) => {
        console.log('[push] APNs error', String(e).slice(0, 150));
        resolve(false);
      });
      req.end(payload);
    } catch (e) {
      console.log('[push] APNs error', String(e).slice(0, 150));
      resolve(false);
    }
  });
}
