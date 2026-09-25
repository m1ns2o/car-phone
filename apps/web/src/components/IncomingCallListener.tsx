import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff } from 'lucide-react';
import { wsUrlWithAuth } from '@carphone/api';
import { useAuth } from '../stores/auth';
import type { SignalMessage } from '@carphone/shared';

// 로그인 유저에게 걸려오는 CALL_INVITE를 전역 수신 → 수락/거절 모달
export function IncomingCallListener() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [invite, setInvite] = useState<{ roomId: string; from: string; fromUserId?: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const ws = new WebSocket(wsUrlWithAuth());
    const hb = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ t: 'PING' }));
        } catch {
          /* ignore */
        }
      }
    }, 25000);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as SignalMessage;
        if (msg.t === 'CALL_INVITE') {
          setInvite({ roomId: msg.roomId, from: msg.from, fromUserId: msg.fromUserId });
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      clearInterval(hb);
      ws.close();
    };
  }, [user]);

  if (!invite) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-[380px] rounded-[24px] border border-white/10 bg-night-800 p-6 text-center shadow-2xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint-400/15">
          <Phone size={26} className="text-mint-400" />
        </span>
        <h3 className="mt-3 text-[19px] font-extrabold text-white">수신 통화</h3>
        <p className="mt-1 text-[14px] text-mist-500">
          <b className="text-white">{invite.from}</b>님이 통화을 요청합니다
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setInvite(null)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/8 py-3.5 text-[15px] font-bold text-white"
          >
            <PhoneOff size={17} /> 거절
          </button>
          <button
            onClick={() => {
              const inv = invite;
              setInvite(null);
              const params = new URLSearchParams({ name: user?.username ?? 'guest' });
              if (inv.fromUserId) params.set('peerId', inv.fromUserId);
              params.set('peerName', inv.from);
              nav(`/call/${encodeURIComponent(inv.roomId)}?${params.toString()}`);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-mint-400 py-3.5 text-[15px] font-bold text-[#052e1b]"
          >
            <Phone size={17} /> 수락
          </button>
        </div>
      </div>
    </div>
  );
}
