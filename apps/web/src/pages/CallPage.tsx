import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Mic, MicOff, PhoneOff, Phone, RefreshCw, ChevronDown, Signal, Copy, Check, Link2 } from 'lucide-react';
import { useCall } from '../hooks/useCall';
import { callsApi } from '@carphone/api';
import { useAuth } from '../stores/auth';
import { getDisplayName } from '../lib/displayName';
import { Shell } from '../components/Shell';
import { Button, Card, StatusChip } from '../components/ui';
import { cn } from '../lib/cn';

export function CallPage() {
  const { roomId = 'test' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const name = sp.get('name') || getDisplayName() || 'guest';
  const peerId = sp.get('peerId') || undefined;
  const peerName = sp.get('peerName') || undefined;
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const c = useCall({ roomId, name, remoteAudio: audioRef, inviteTo: peerId, inviteFrom: user?.id });

  async function leave(status: string = 'ended') {
    if (user && peerId) {
      try {
        await callsApi.record({ roomId, otherUserId: peerId, status, durationSec: c.seconds });
      } catch {
        /* 기록 실패해도 통화 종료는 진행 */
      }
    }
    c.hangup(true);
    nav(user ? '/history' : '/');
  }

  const connected = c.status === 'connected';
  const closed = c.status === 'closed';

  const chip = useMemo(() => {
    if (connected) return <StatusChip tone="live">연결됨</StatusChip>;
    if (c.status === 'failed') return <StatusChip tone="bad">실패</StatusChip>;
    if (closed) return <StatusChip tone="bad">종료됨</StatusChip>;
    if (c.status === 'connecting' || c.status === 'offering') return <StatusChip tone="wait">연결 중…</StatusChip>;
    return <StatusChip tone="wait">대기 중…</StatusChip>;
  }, [c.status, connected, closed]);

  return (
    <Shell title={`방 ${roomId}`} hideNav>
      <div className="flex flex-col items-center pt-4">
        {chip}

        {/* 아바타 — Discord식 링 + 연결 시 펄스 */}
        <div className={cn('mt-5 flex h-24 w-24 items-center justify-center rounded-full text-[38px] font-extrabold',
          connected ? 'ring-live bg-mint-400 text-[#052e1b]' : 'bg-night-700 text-white')}>
          {(name || '?').slice(0, 1).toUpperCase()}
        </div>

        <h2 className="mt-4 text-[19px] font-extrabold">{peerName || roomId}</h2>
        <p className="mt-1 text-[13px] text-mist-500">
          나 {name} · 상대 {c.peerJoined ? '입장함' : '대기 중'}{peerName ? ` · 방 ${roomId}` : ''}
        </p>
        <p className="tabular mt-2 text-[44px] font-extrabold leading-none tracking-tight">{c.time}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-mist-500">
          <Signal size={12} />
          pc {c.connectionState} · ice {c.iceState}
          {c.stats?.rttMs != null ? ` · ${c.stats.rttMs.toFixed(0)}ms` : ''}
        </span>

        <audio ref={audioRef} autoPlay playsInline controls className="mt-4 w-full" />

        <ShareInvite roomId={roomId} />

        {c.error && (
          <div className="mt-3 w-full rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-500">
            ⚠️ {c.error}
          </div>
        )}

        <Card className="mt-4 w-full p-4">
          {connected ? (
            /* iOS 전화식 하단 독 */
            <div className="flex items-center justify-center gap-8 py-2">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={c.toggleMute}
                  aria-label="mute"
                  className={cn('flex h-[72px] w-[72px] items-center justify-center rounded-full transition active:scale-95',
                    c.muted ? 'bg-amber-400 text-black' : 'bg-white/10 text-white')}
                >
                  {c.muted ? <MicOff size={28} /> : <Mic size={28} />}
                </button>
                <span className="text-[12px] text-mist-500">{c.muted ? '음소거 해제' : '음소거'}</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => void leave()}
                  aria-label="hangup"
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-rose-500 text-white shadow-[0_6px_24px_rgba(251,77,109,0.4)] transition active:scale-95"
                >
                  <PhoneOff size={28} />
                </button>
                <span className="text-[12px] text-mist-500">종료</span>
              </div>
            </div>
          ) : closed ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => nav('/')}>홈으로</Button>
              <Button onClick={() => location.reload()}>다시 입장</Button>
            </div>
          ) : (
            <Button disabled={!c.peerJoined} onClick={() => void c.startCall()}>
              <Phone size={18} /> {c.peerJoined ? '통화 시작' : '상대 대기 중…'}
            </Button>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={c.toggleMute}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[14px] font-bold text-mist-300"
            >
              {c.muted ? <MicOff size={15} /> : <Mic size={15} />} {c.muted ? '해제' : '음소거'}
            </button>
            <button
              onClick={() => void c.restartIce()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[14px] font-bold text-mist-300"
            >
              <RefreshCw size={15} /> ICE 재시작
            </button>
          </div>

          {!connected && !closed && (
            <button
              onClick={() => void leave()}
              className="mt-3 w-full py-2 text-center text-[14px] font-bold text-rose-500"
            >
              나가기
            </button>
          )}
        </Card>

        <details className="group mt-3 w-full rounded-2xl border border-white/8 bg-night-800/90">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-[13px] font-bold text-mist-300">
            연결 로그 ({c.logs.length})
            <ChevronDown size={16} className="transition group-open:rotate-180" />
          </summary>
          <div className="nice-scroll max-h-56 overflow-auto border-t border-white/8 p-3 font-mono text-[11px] leading-relaxed text-mist-500">
            {c.logs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </details>

        {/* 운전 중 조작 안내 */}
        <p className="mt-4 pb-2 text-center text-[12px] text-mist-500">
          운전 중에는 음소거 · 종료 두 버튼만 사용하세요
        </p>
      </div>
    </Shell>
  );
}

// 통화방에서도 초대링크 공유 (한 줄 컴팩트)
function ShareInvite({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);
  const invite = `${location.origin}/call/${roomId}`;
  return (
    <div className="mt-3 flex w-full items-center gap-2 rounded-2xl border border-white/8 bg-night-800 px-3 py-2.5">
      <Link2 size={15} className="shrink-0 text-mint-400" />
      <span className="flex-1 truncate font-mono text-[12px] text-mist-300">{invite.replace(/^https?:\/\//, '')}</span>
      <button
        onClick={async () => {
          await navigator.clipboard?.writeText(invite);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="초대링크 복사"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white"
      >
        {copied ? <Check size={16} className="text-mint-400" /> : <Copy size={16} />}
      </button>
    </div>
  );
}
