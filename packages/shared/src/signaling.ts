// Signaling protocol — 웹/RN/서버 단일 진실원천
// 서버는 zod로 재검증. 클라이언트는 이 타입만 사용.

export const SignalTypes = [
  'CALL_INVITE',
  'CALL_REQUEST',
  'CALL_ACCEPT',
  'CALL_REJECT',
  'CALL_END',
  'SDP_OFFER',
  'SDP_ANSWER',
  'ICE_CANDIDATE',
  'CALL_STATE',
  'PING',
  'PONG',
  'ROOM_JOIN',
  'ROOM_PEER_JOINED',
  'ROOM_PEER_LEFT',
  'ERROR',
] as const;

export type SignalType = (typeof SignalTypes)[number];

export interface BaseSignal {
  t: SignalType;
  roomId?: string;
}

// --- Call control ---
export interface CallRequestSignal extends BaseSignal {
  t: 'CALL_REQUEST';
  roomId: string;
  from: string; // display name (PoC) / userId (P3+)
}

export interface CallInviteSignal extends BaseSignal {
  t: 'CALL_INVITE';
  roomId: string;
  toUserId: string;
  from: string; // caller username
  fromUserId?: string; // caller id (있으면 수신자도 통화기록 가능)
}

export interface CallAcceptSignal extends BaseSignal {
  t: 'CALL_ACCEPT';
  roomId: string;
}

export interface CallRejectSignal extends BaseSignal {
  t: 'CALL_REJECT';
  roomId: string;
  reason?: string;
}

export interface CallEndSignal extends BaseSignal {
  t: 'CALL_END';
  roomId: string;
}

// --- SDP / ICE ---
export interface SdpOfferSignal extends BaseSignal {
  t: 'SDP_OFFER';
  roomId: string;
  sdp: string;
}

export interface SdpAnswerSignal extends BaseSignal {
  t: 'SDP_ANSWER';
  roomId: string;
  sdp: string;
}

export interface IceCandidateSignal extends BaseSignal {
  t: 'ICE_CANDIDATE';
  roomId: string;
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

// --- State / keepalive ---
export interface CallStateSignal extends BaseSignal {
  t: 'CALL_STATE';
  roomId: string;
  state: string; // RTCPeerConnectionState 그대로 전달
}

export type SignalMessage =
  | CallInviteSignal
  | CallRequestSignal
  | CallAcceptSignal
  | CallRejectSignal
  | CallEndSignal
  | SdpOfferSignal
  | SdpAnswerSignal
  | IceCandidateSignal
  | CallStateSignal
  | { t: 'PING' }
  | { t: 'PONG' }
  | { t: 'ROOM_JOIN'; roomId: string; name?: string }
  | { t: 'ROOM_PEER_JOINED'; roomId: string }
  | { t: 'ROOM_PEER_LEFT'; roomId: string }
  | { t: 'ERROR'; message: string };

export function isSignalMessage(v: unknown): v is SignalMessage {
  if (typeof v !== 'object' || v === null) return false;
  const t = (v as Record<string, unknown>).t;
  return typeof t === 'string' && (SignalTypes as readonly string[]).includes(t);
}
