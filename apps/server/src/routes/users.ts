import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/users/search', { preHandler: requireAuth }, async (req) => {
    const q = z.object({ q: z.string().min(1).max(30) }).safeParse(req.query);
    if (!q.success) return { data: { users: [] } };
    const like = `%${q.data.q.toLowerCase()}%`;
    const rows = db
      .prepare(`SELECT id, username FROM users WHERE username_lower LIKE ? AND id <> ? ORDER BY username LIMIT 20`)
      .all(like, req.user!.id);
    return { data: { users: rows } };
  });
}
