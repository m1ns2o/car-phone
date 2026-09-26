import { isOnline } from '../ws/presence.js';
import { listPushTokens } from './tokens.js';
import { sendFcmInvite } from './fcm.js';
import { sendApnsInvite } from './apns.js';

// CALL_INVITE가 온라인 소켓에 닿지 않을 때 푸시 발송.
// 키 미설정 시 로그만 (착신은 다음 입장 시 mailbox/재전송으로 커버).
export async function pushInvite(opts: {
  toUserId: string;
  roomId: string;
  from: string;
  fromUserId?: string;
}): Promise<void> {
  if (isOnline(opts.toUserId)) return; // 온라인이면 WS로 이미 전달됨
  const tokens = listPushTokens(opts.toUserId);
  if (tokens.length === 0) {
    console.log(`[push] no tokens for ${opts.toUserId.slice(0, 8)}…`);
    return;
  }
  const data = { roomId: opts.roomId, from: opts.from, fromUserId: opts.fromUserId };
  await Promise.all(tokens.map(async (t) => {
    if (t.platform === 'android') await sendFcmInvite(t.token, data);
    else if (t.platform === 'ios') await sendApnsInvite(t.token, data);
  }));
}
