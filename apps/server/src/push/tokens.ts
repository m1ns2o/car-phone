import { db } from '../db/client.js';

// 푸시 토큰 저장 (FCM/APNs). 키 없으면 전송만 스킵, 저장은 항상.
export type PushPlatform = 'android' | 'ios';

export function savePushToken(userId: string, platform: PushPlatform, token: string): void {
  db.prepare(
    `INSERT INTO push_tokens (user_id, platform, token, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT (user_id, platform) DO UPDATE SET token = excluded.token, updated_at = datetime('now')`,
  ).run(userId, platform, token);
}

export function listPushTokens(userId: string): { platform: string; token: string }[] {
  return db
    .prepare(`SELECT platform, token FROM push_tokens WHERE user_id = ?`)
    .all(userId) as { platform: string; token: string }[];
}

export function deletePushToken(userId: string, token: string): void {
  db.prepare(`DELETE FROM push_tokens WHERE user_id = ? AND token = ?`).run(userId, token);
}
