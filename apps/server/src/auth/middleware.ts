import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccess } from './jwt.js';

export interface AuthedUser {
  id: string;
  username: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthedUser;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    void reply.code(401).send({ error: 'unauthorized' });
    return;
  }
  try {
    const payload = verifyAccess(header.slice(7));
    req.user = { id: payload.sub, username: payload.username };
  } catch {
    void reply.code(401).send({ error: 'invalid token' });
  }
}
