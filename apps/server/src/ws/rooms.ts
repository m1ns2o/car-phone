import type { WebSocket } from '@fastify/websocket';

// roomId -> sockets (PoC: 최대 2명, P3부터 auth+친구검증 추가)
const rooms = new Map<string, Set<WebSocket>>();

export function joinRoom(roomId: string, ws: WebSocket): number {
  let set = rooms.get(roomId);
  if (!set) {
    set = new Set();
    rooms.set(roomId, set);
  }
  set.add(ws);
  (ws as WebSocket & { __roomId?: string }).__roomId = roomId;
  return set.size;
}

export function peersOf(roomId: string, except: WebSocket): WebSocket[] {
  const set = rooms.get(roomId);
  if (!set) return [];
  return [...set].filter((s) => s !== except);
}

export function leaveSocket(ws: WebSocket): string | undefined {
  const roomId = (ws as WebSocket & { __roomId?: string }).__roomId;
  if (!roomId) return undefined;
  const set = rooms.get(roomId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(roomId);
  }
  return roomId;
}

export function roomSize(roomId: string): number {
  return rooms.get(roomId)?.size ?? 0;
}
