import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
import { db, newId } from '../db/client.js';
import { hashPassword } from '../auth/password.js';
import { signAccess, signRefresh, verifyRefresh } from '../auth/jwt.js';
import { requireAuth } from '../auth/middleware.js';

// ID/비밀번호 로그인은 비활성화 — Google OAuth만 사용.
// (기존 로컬 계정은 DB에 유지되며, 같은 google_sub 연동 없이 로그인할 수는 없음)

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/refresh', async (req, reply) => {
    const token = req.cookies.cp_refresh as string | undefined;
    if (!token) return reply.code(401).send({ error: 'no refresh token' });
    try {
      const { sub } = verifyRefresh(token);
      const row = db.prepare('SELECT id, username FROM users WHERE id = ?').get(sub) as
        | { id: string; username: string }
        | undefined;
      if (!row) return reply.code(401).send({ error: 'user gone' });
      return { data: { accessToken: signAccess(row.id, row.username) } };
    } catch {
      return reply.code(401).send({ error: 'invalid refresh' });
    }
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie('cp_refresh', { path: '/' });
    return { data: { ok: true } };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    return { data: { user: req.user } };
  });

  // Google OAuth — 프론트 GIS 버튼이 받은 idToken(credential)을 검증 후 우리 JWT 발급
  app.post('/api/auth/google', async (req, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return reply.code(500).send({ error: 'google not configured' });
    const parsed = z.object({ idToken: z.string().min(10) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid input' });

    let sub: string;
    let email = '';
    try {
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({ idToken: parsed.data.idToken, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub || payload.email_verified === false) {
        return reply.code(401).send({ error: 'google verification failed' });
      }
      sub = payload.sub;
      email = payload.email ?? '';
    } catch {
      return reply.code(401).send({ error: 'google verification failed' });
    }

    // 기존 연동 계정 확인
    let user = db.prepare('SELECT id, username FROM users WHERE google_sub = ?').get(sub) as
      | { id: string; username: string }
      | undefined;

    if (!user) {
      // username 후보: 이메일 앞부분 정제 (영문·숫자·한글·_·. 만 허용)
      const base = (email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9가-힣_.]/g, '').slice(0, 14) || 'user';
      let username = base;
      for (let i = 0; i < 5; i++) {
        const exists = db.prepare('SELECT id FROM users WHERE username_lower = ?').get(username.toLowerCase());
        if (!exists) break;
        username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
      }
      const password_hash = await hashPassword(randomBytes(32).toString('hex'));
      const id = newId();
      db.prepare(
        'INSERT INTO users (id, username, username_lower, password_hash, google_sub) VALUES (?,?,?,?,?)',
      ).run(id, username, username.toLowerCase(), password_hash, sub);
      user = { id, username };
    }

    const accessToken = signAccess(user.id, user.username);
    const refreshToken = signRefresh(user.id);
    reply.setCookie('cp_refresh', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 14 * 24 * 3600,
    });
    return { data: { user: { id: user.id, username: user.username }, accessToken } };
  });
}
