import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { savePushToken, deletePushToken } from '../push/tokens.js';

export function pushRoutes(app: FastifyInstance): void {
  // 푸시 토큰 등록 (FCM/APNs)
  app.post('/api/push/token', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = z.object({
      platform: z.enum(['android', 'ios']),
      token: z.string().min(10).max(500),
    }).safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid body' };
    }
    savePushToken(req.user!.id, parsed.data.platform, parsed.data.token);
    return { ok: true };
  });

  app.delete('/api/push/token', { preHandler: requireAuth }, async (req) => {
    const q = (req.query ?? {}) as { token?: string };
    if (q.token) deletePushToken(req.user!.id, q.token);
    return { ok: true };
  });
}
