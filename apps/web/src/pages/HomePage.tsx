import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, RefreshCw, Copy, Check, Mic, Car, Timer, ShieldCheck, Users, Pencil } from 'lucide-react';
import { Shell } from '../components/Shell';
import { Button, Card, Field } from '../components/ui';
import { useAuth } from '../stores/auth';
import { getDisplayName } from '../lib/displayName';

function randomRoom(): string {
  return Math.random().toString(36).slice(2, 8);
}

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
      <div className="mt-2 flex gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-400/30 bg-mint-400/10 px-3 py-1 text-[12px] font-bold text-mint-400">
          <Mic size={13} /> WebRTC 음성통화
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-bold text-mist-300">
          <Car size={13} /> Android Auto 검증
        </span>
      </div>

      <h2 className="mt-4 text-[26px] font-extrabold leading-tight tracking-tight">
        링크 하나로,
        <br />
        바로 통화하세요.
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-mist-500">
        설치 없이 1:1 인터넷 음성통화. 같은 방 ID로 2개 브라우저에서 입장하면 됩니다.
      </p>

      <button
        onClick={() => nav('/settings')}
        className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-white/8 bg-night-800 px-4 py-3 text-left"
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

      <Card className="mt-3 p-5">
        <div className="space-y-4">
          <div>
            <Field label="방 ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="room id" maxLength={64} />
            <button
              onClick={() => setRoomId(randomRoom())}
              className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-mist-500 hover:text-white"
            >
              <RefreshCw size={13} /> 새 방 ID 생성
            </button>
          </div>
          <Button onClick={join}>
            <Phone size={18} /> 통화방 입장
          </Button>
        </div>
      </Card>

      <Card className="mt-3 p-5">
        <p className="text-[13px] font-bold text-mist-300">초대링크 — 상대에게 공유</p>
        <p className="mt-2 break-all rounded-xl bg-night-900 p-3 font-mono text-[12px] text-mist-300">{invite}</p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={async () => {
            await navigator.clipboard?.writeText(invite);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? '복사됨!' : '링크 복사'}
        </Button>
      </Card>

      {user ? (
        <Card className="mt-3 flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mint-400 text-[18px] font-extrabold text-[#052e1b]">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">{user.username}</span>
            <span className="block text-[12px] text-mist-500">로그인됨</span>
          </span>
          <button onClick={() => nav('/friends')} className="flex items-center gap-1 rounded-xl bg-mint-400 px-3 py-2 text-[13px] font-bold text-[#052e1b]">
            <Users size={15} /> 친구
          </button>
        </Card>
      ) : (
        <Button className="mt-3" onClick={() => nav('/login')}>Google로 시작하기</Button>
      )}

      <div className="mt-3 space-y-2">
        <Tip icon={<Timer size={15} />} text="5·10·20분 장시간 통화 테스트용 타이머·연결 로그 내장" />
        <Tip icon={<ShieldCheck size={15} />} text={<>처음이라면 <Link to="/debug" className="font-bold text-sky-300">오디오 진단</Link>에서 마이크 권한을 먼저 확인 (모바일은 HTTPS 필수)</>} />
      </div>
    </Shell>
  );
}

function Tip({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/5 p-3 text-[13px] leading-relaxed text-mist-300">
      <span className="mt-0.5 text-sky-300">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
