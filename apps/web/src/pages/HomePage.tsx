import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, RefreshCw, Copy, Check, Users, Pencil } from 'lucide-react';
import { Shell } from '../components/Shell';
import { Button, Card, Field } from '../components/ui';
import { GoogleButton } from '../components/GoogleButton';
import { useAuth } from '../stores/auth';
import { getDisplayName } from '../lib/displayName';

function randomRoom(): string {
  return Math.random().toString(36).slice(2, 8);
}

// 첫 화면 = 스크롤 없이 입장 + 로그인까지 (최신폰 700px+ 기준)
export function HomePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [roomId, setRoomId] = useState(randomRoom());
  const [copied, setCopied] = useState(false);
  // 표시 이름: 로그인 유저는 username, 게스트는 설정에서 저장한 이름
  const name = user?.username ?? getDisplayName() ?? 'guest';

  const invite = `${location.origin}/call/${roomId}`;
  const join = () =>
    nav(`/call/${encodeURIComponent(roomId.trim() || randomRoom())}?name=${encodeURIComponent(name)}`);

  return (
    <Shell title="CarPhone">
      <button
        onClick={() => nav('/settings')}
        className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-white/8 bg-night-800 px-4 py-2.5 text-left"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint-400/15 text-[15px] font-extrabold text-mint-400">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-bold">{name}</span>
          <span className="block text-[12px] text-mist-500">내 표시 이름으로 입장합니다</span>
        </span>
        <Pencil size={15} className="text-mist-500" />
      </button>

      <Card className="mt-2.5 p-4">
        <Field label="방 ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="room id" maxLength={64} />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setRoomId(randomRoom())}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-mist-500 hover:text-white"
          >
            <RefreshCw size={13} /> 새 방 ID
          </button>
          <div className="flex-1" />
          <button
            onClick={async () => {
              await navigator.clipboard?.writeText(invite);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-white/6 px-2.5 py-1.5 font-mono text-[11px] text-mist-300"
            aria-label="초대링크 복사"
          >
            <span className="max-w-[150px] truncate">{invite.replace(/^https?:\/\//, '')}</span>
            {copied ? <Check size={14} className="text-mint-400" /> : <Copy size={14} />}
          </button>
        </div>
        <Button className="mt-3" onClick={join}>
          <Phone size={18} /> 통화방 입장
        </Button>
      </Card>

      {user ? (
        <button
          onClick={() => nav('/friends')}
          className="mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-night-800 p-3 text-left"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint-400 text-[17px] font-extrabold text-[#052e1b]">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex-1 text-[14px] font-bold">{user.username}</span>
          <span className="flex items-center gap-1 rounded-xl bg-mint-400 px-3 py-2 text-[13px] font-bold text-[#052e1b]">
            <Users size={15} /> 친구
          </span>
        </button>
      ) : (
        <div className="mt-2.5">
          <GoogleButton />
          <p className="mt-1.5 text-center text-[12px] text-mist-500">로그인하면 친구 호출·통화기록 사용 가능</p>
        </div>
      )}
    </Shell>
  );
}
