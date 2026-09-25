import type { WebSocket } from '@fastify/websocket';

// userId -> sockets (presence + CALL_INVITE mailbox)
const userSockets = new Map<string, Set<WebSocket>>();

export function markOnline(userId: string, ws: WebSocket): void {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(ws);
  (ws as WebSocket & { __userId?: string }).__userId = userId;
}

export function markOffline(ws: WebSocket): string | undefined {
  const userId = (ws as WebSocket & { __userId?: string }).__userId;
  if (!userId) return undefined;
  const set = userSockets.get(userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) userSockets.delete(userId);
  }
  return userId;
}

export function isOnline(userId: string): boolean {
  return userSockets.has(userId);
}

export function socketsOf(userId: string): WebSocket[] {
  return [...(userSockets.get(userId) ?? [])];
}
