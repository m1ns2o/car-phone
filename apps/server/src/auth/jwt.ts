import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-32chars-min';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-32chars-min';

export interface AccessPayload {
  sub: string; // userId
  username: string;
}

export function signAccess(userId: string, username: string): string {
  return jwt.sign({ sub: userId, username } satisfies AccessPayload, ACCESS_SECRET, { expiresIn: '15m' });
}

export function signRefresh(userId: string): string {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: '14d' });
}

export function verifyAccess(token: string): AccessPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessPayload;
}

export function verifyRefresh(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}
