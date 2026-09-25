export type CallStatus = 'requested' | 'accepted' | 'rejected' | 'ended' | 'failed';

export interface CallRecord {
  id: string;
  roomId: string;
  callerId: string;
  calleeId: string;
  status: CallStatus | 'missed';
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  otherId?: string;
  otherName?: string;
  direction?: 'outgoing' | 'incoming';
}

export type ConnectionStatus =
  | 'idle'
  | 'joining'
  | 'waiting-peer'
  | 'offering'
  | 'answering'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';
