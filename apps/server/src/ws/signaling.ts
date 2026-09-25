import { z } from 'zod';

// PoC 검증 스키마 — shared 타입과 1:1 대응. 잘못된 메시지는 relay하지 않음.
const base = z.object({ roomId: z.string().min(1).max(64).optional() });

export const signalSchema = z.union([
  base.extend({ t: z.literal('ROOM_JOIN'), roomId: z.string().min(1).max(64), name: z.string().max(40).optional() }),
  base.extend({ t: z.literal('CALL_REQUEST'), roomId: z.string().min(1).max(64), from: z.string().max(40) }),
  // 친구 호출: 온라인 유저의 모든 소켓으로 직접 전달 (P4)
  base.extend({
    t: z.literal('CALL_INVITE'),
    roomId: z.string().min(1).max(64),
    toUserId: z.string().uuid(),
    from: z.string().max(40),
    fromUserId: z.string().uuid().optional(),
  }),
  base.extend({ t: z.literal('CALL_ACCEPT'), roomId: z.string().min(1).max(64) }),
  base.extend({ t: z.literal('CALL_REJECT'), roomId: z.string().min(1).max(64), reason: z.string().max(200).optional() }),
  base.extend({ t: z.literal('CALL_END'), roomId: z.string().min(1).max(64) }),
  base.extend({ t: z.literal('SDP_OFFER'), roomId: z.string().min(1).max(64), sdp: z.string().min(1).max(20000) }),
  base.extend({ t: z.literal('SDP_ANSWER'), roomId: z.string().min(1).max(64), sdp: z.string().min(1).max(20000) }),
  base.extend({
    t: z.literal('ICE_CANDIDATE'),
    roomId: z.string().min(1).max(64),
    candidate: z.string().min(1).max(5000),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().nullable().optional(),
  }),
  base.extend({ t: z.literal('CALL_STATE'), roomId: z.string().min(1).max(64), state: z.string().max(30) }),
  base.extend({ t: z.literal('PING') }),
  base.extend({ t: z.literal('PONG') }),
]);

export type ValidSignal = z.infer<typeof signalSchema>;
