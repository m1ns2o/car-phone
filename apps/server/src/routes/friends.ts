import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, newId } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';
import { isOnline } from '../ws/presence.js';

export async function friendRoutes(app: FastifyInstance): Promise<void> {
  // 친구 목록 (상대 username + 온라인 여부)
  app.get('/api/friends', { preHandler: requireAuth }, async (req) => {
    const me = req.user!.id;
    const rows = db
      .prepare(
        `SELECT u.id, u.username FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? ORDER BY u.username`,
      )
      .all(me) as { id: string; username: string }[];
    const friends = rows.map((r) => ({
      id: r.id,
      username: r.username,
      online: isOnline(r.id),
    }));
    return { data: { friends } };
  });

  // 친구 요청 보내기 (username 기준 — UX 단순)
  app.post('/api/friends/request', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = z.object({ username: z.string().min(1).max(20) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid input' });
    const me = req.user!.id;

    const target = db
      .prepare('SELECT id FROM users WHERE username_lower = ?')
      .get(parsed.data.username.toLowerCase()) as { id: string } | undefined;
    if (!target) return reply.code(404).send({ error: 'user not found' });
    if (target.id === me) return reply.code(400).send({ error: 'cannot add self' });

    const already = db
      .prepare('SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?')
      .get(me, target.id);
    if (already) return reply.code(409).send({ error: 'already friends' });

    try {
      db.prepare('INSERT INTO friend_requests (id, sender_id, receiver_id) VALUES (?,?,?)').run(
        newId(),
        me,
        target.id,
      );
    } catch {
      return reply.code(409).send({ error: 'request already sent' });
    }
    return { data: { ok: true } };
  });

  // 요청함
  app.get('/api/friends/requests', { preHandler: requireAuth }, async (req) => {
    const me = req.user!.id;
    const incoming = db
      .prepare(
        `SELECT r.id, r.sender_id AS "senderId", r.receiver_id AS "receiverId", r.status, r.created_at AS "createdAt", u.username AS "senderName"
       FROM friend_requests r JOIN users u ON u.id = r.sender_id
       WHERE r.receiver_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`,
      )
      .all(me);
    const outgoing = db
      .prepare(
        `SELECT r.id, r.sender_id AS "senderId", r.receiver_id AS "receiverId", r.status, r.created_at AS "createdAt", u.username AS "receiverName"
       FROM friend_requests r JOIN users u ON u.id = r.receiver_id
       WHERE r.sender_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`,
      )
      .all(me);
    return { data: { incoming, outgoing } };
  });

  // 수락 — 양방향 friendship 생성 + 요청 accepted
  app.post('/api/friends/requests/:id/accept', { preHandler: requireAuth }, async (req, reply) => {
    const me = req.user!.id;
    const id = (req.params as { id: string }).id;
    const r = db
      .prepare(
        `SELECT sender_id, receiver_id FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = 'pending'`,
      )
      .get(id, me) as { sender_id: string; receiver_id: string } | undefined;
    if (!r) return reply.code(404).send({ error: 'request not found' });

    const acceptTx = db.transaction(() => {
      db.prepare(`INSERT OR IGNORE INTO friendships (id, user_id, friend_id) VALUES (?,?,?)`).run(
        newId(),
        r.sender_id,
        r.receiver_id,
      );
      db.prepare(`INSERT OR IGNORE INTO friendships (id, user_id, friend_id) VALUES (?,?,?)`).run(
        newId(),
        r.receiver_id,
        r.sender_id,
      );
      db.prepare(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`).run(id);
    });
    acceptTx();
    return { data: { ok: true } };
  });

  app.post('/api/friends/requests/:id/reject', { preHandler: requireAuth }, async (req, reply) => {
    const me = req.user!.id;
    const id = (req.params as { id: string }).id;
    const res = db
      .prepare(
        `UPDATE friend_requests SET status = 'rejected' WHERE id = ? AND receiver_id = ? AND status = 'pending'`,
      )
      .run(id, me);
    if (!res.changes) return reply.code(404).send({ error: 'request not found' });
    return { data: { ok: true } };
  });

  // 친구 삭제 — 양방향 제거
  app.delete('/api/friends/:id', { preHandler: requireAuth }, async (req) => {
    const me = req.user!.id;
    const fid = (req.params as { id: string }).id;
    db.prepare(
      'DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
    ).run(me, fid, fid, me);
    return { data: { ok: true } };
  });
}
