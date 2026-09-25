import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, newId } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';

export async function callRoutes(app: FastifyInstance): Promise<void> {
  // 통화 종료 시 클라이언트가 기록 (MVP: direction은 서버가 판별)
  app.post('/api/calls', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = z
      .object({
        roomId: z.string().min(1).max(64),
        otherUserId: z.string().uuid().optional(),
        status: z.enum(['ended', 'rejected', 'missed', 'failed']).default('ended'),
        durationSec: z.number().int().min(0).max(86400).default(0),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid input' });
    const me = req.user!.id;
    const { roomId, otherUserId, status, durationSec } = parsed.data;
    // otherUserId가 친구가 아니어도 기록은 허용 (게스트 제외). callee null이면 나간 기록만.
    db.prepare(
      `INSERT INTO calls (id, room_id, caller_id, callee_id, status, ended_at, duration_sec)
       VALUES (?,?,?,?,?, datetime('now'), ?)`,
    ).run(newId(), roomId, me, otherUserId ?? null, status, durationSec);
    return { data: { ok: true } };
  });

  app.get('/api/calls/history', { preHandler: requireAuth }, async (req) => {
    const me = req.user!.id;
    const rows = db
      .prepare(
        `SELECT c.id, c.room_id AS "roomId", c.caller_id AS "callerId", c.callee_id AS "calleeId",
              c.status, c.started_at AS "startedAt", c.ended_at AS "endedAt", c.duration_sec AS "durationSec",
              CASE WHEN c.caller_id = ? THEN cu.username ELSE cr.username END AS "otherName",
              CASE WHEN c.caller_id = ? THEN c.callee_id ELSE c.caller_id END AS "otherId",
              CASE WHEN c.caller_id = ? THEN 'outgoing' ELSE 'incoming' END AS "direction"
       FROM calls c
       LEFT JOIN users cr ON cr.id = c.caller_id
       LEFT JOIN users cu ON cu.id = c.callee_id
       WHERE c.caller_id = ? OR c.callee_id = ?
       ORDER BY c.started_at DESC LIMIT 50`,
      )
      .all(me, me, me, me, me);
    return { data: { calls: rows } };
  });
}
