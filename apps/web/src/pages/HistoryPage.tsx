import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone } from 'lucide-react';
import { callsApi } from '@carphone/api';
import type { CallRecord } from '@carphone/shared';
import { Shell } from '../components/Shell';
import { Card } from '../components/ui';

function fmtDur(sec?: number): string {
  const s = sec ?? 0;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function HistoryPage() {
  const nav = useNavigate();
  const [calls, setCalls] = useState<CallRecord[]>([]);

  useEffect(() => {
    void callsApi.history().then((r) => setCalls(r.data.calls)).catch(() => {});
  }, []);

  return (
    <Shell title="최근 통화">
      <div className="mt-3 space-y-2">
        {calls.map((c) => {
          const missed = c.status === 'missed' || c.status === 'rejected';
          const Icon = missed ? PhoneMissed : c.direction === 'outgoing' ? PhoneOutgoing : PhoneIncoming;
          const color = missed ? 'text-rose-500' : 'text-mint-400';
          return (
            <Card key={c.id} className="flex items-center gap-3 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-night-700 text-[17px] font-extrabold">
                {(c.otherName ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-1.5 text-[15px] font-bold">
                  <Icon size={15} className={color} /> {c.otherName ?? '(알 수 없음)'}
                </span>
                <span className="tabular block text-[12px] text-mist-500">
                  {fmtDate(c.startedAt)} · {fmtDur(c.durationSec)}
                </span>
              </span>
              {c.otherId && (
                <button
                  onClick={() => {
                    const room = Math.random().toString(36).slice(2, 10);
                    nav(`/call/${room}?peerId=${encodeURIComponent(c.otherId!)}&peerName=${encodeURIComponent(c.otherName ?? '')}`);
                  }}
                  aria-label="redial"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-mint-400 text-[#052e1b]"
                >
                  <Phone size={18} />
                </button>
              )}
            </Card>
          );
        })}
        {calls.length === 0 && (
          <Card className="p-6 text-center text-[13px] text-mist-500">
            아직 통화 기록이 없습니다. 친구 탭에서 전화를 걸어보세요.
          </Card>
        )}
      </div>
    </Shell>
  );
}
