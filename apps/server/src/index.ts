import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// monorepo 루트의 .env 로드 (tsx cwd가 apps/server이므로 명시적 경로)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import { signalSchema } from './ws/signaling.js';
import { joinRoom, peersOf, leaveSocket, roomSize } from './ws/rooms.js';
import { markOnline, markOffline, socketsOf } from './ws/presence.js';
import { verifyAccess } from './auth/jwt.js';
import { migrate } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { friendRoutes } from './routes/friends.js';
import { callRoutes } from './routes/calls.js';

const PORT = Number(process.env.SERVER_PORT ?? 3000);
const VERSION = '0.2.0-friends';

const app = Fastify({ logger: true });

await app.register(cookie);
await app.register(cors, { origin: true, credentials: true });
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
await app.register(websocket);

migrate();

app.get('/api/health', async () => ({ ok: true, version: VERSION }));
await app.register(authRoutes);
await app.register(userRoutes);
await app.register(friendRoutes);
await app.register(callRoutes);

// WS signaling — 같은 roomId 2명에게 relay (음성은 P2P) + 로그인 유저는 CALL_INVITE 수신
app.register(async (f) => {
  f.get('/ws', { websocket: true }, (socket, req) => {
    let msgCount = 0;
    let joinedRoom: string | undefined;

    // ?token=JWT 있으면 presence 등록 (게스트는 생략 가능)
    try {
      const url = new URL(req.url ?? '/ws', 'http://local');
      const token = url.searchParams.get('token');
      if (token) {
        const payload = verifyAccess(token);
        markOnline(payload.sub, socket);
      }
    } catch {
      /* guest */
    }

    socket.on('message', (raw: Buffer | string) => {
      msgCount++;
      if (msgCount > 60) {
        socket.send(JSON.stringify({ t: 'ERROR', message: 'rate limited' }));
        return;
      }
      setTimeout(() => msgCount--, 1000);

      let json: unknown;
      try {
        json = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify({ t: 'ERROR', message: 'invalid json' }));
        return;
      }

      const parsed = signalSchema.safeParse(json);
      if (!parsed.success) {
        socket.send(JSON.stringify({ t: 'ERROR', message: 'invalid message' }));
        return;
      }
      const msg = parsed.data;

      if (msg.t === 'PING') {
        socket.send(JSON.stringify({ t: 'PONG' }));
        return;
      }
      if (msg.t === 'PONG') return;

      // 친구 호출 초대 — 수신자 온라인 소켓에 직접 전달
      if (msg.t === 'CALL_INVITE') {
        for (const peer of socketsOf(msg.toUserId)) {
          if (peer !== socket) peer.send(JSON.stringify(msg));
        }
        return;
      }

      if (msg.t === 'ROOM_JOIN') {
        const roomId = msg.roomId;
        if (roomSize(roomId) >= 2) {
          socket.send(JSON.stringify({ t: 'ERROR', message: 'room full (max 2)' }));
          return;
        }
        joinedRoom = roomId;
        const size = joinRoom(roomId, socket);
        for (const peer of peersOf(roomId, socket)) {
          peer.send(JSON.stringify({ t: 'ROOM_PEER_JOINED', roomId }));
        }
        if (size === 2) {
          socket.send(JSON.stringify({ t: 'ROOM_PEER_JOINED', roomId }));
        }
        return;
      }

      const roomId = (msg as { roomId?: string }).roomId;
      if (!roomId) {
        socket.send(JSON.stringify({ t: 'ERROR', message: 'roomId required' }));
        return;
      }
      for (const peer of peersOf(roomId, socket)) {
        peer.send(JSON.stringify(msg));
      }
    });

    socket.on('close', () => {
      markOffline(socket);
      const roomId = leaveSocket(socket) ?? joinedRoom;
      if (roomId) {
        for (const peer of peersOf(roomId, socket)) {
          try {
            peer.send(JSON.stringify({ t: 'ROOM_PEER_LEFT', roomId }));
          } catch {
            /* ignore */
          }
        }
      }
    });
  });
});

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
