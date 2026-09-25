import { useState } from 'react';
import { Check, LogOut, UserRound } from 'lucide-react';
import { Shell } from '../components/Shell';
import { Button, Card, Field } from '../components/ui';
import { useAuth } from '../stores/auth';
import { getDisplayName, setDisplayName } from '../lib/displayName';

// 설정: 게스트 표시 이름 저장 + 계정 정보. 방마다 이름 입력 불필요.
export function SettingsPage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(getDisplayName() ?? '');
  const [saved, setSaved] = useState(false);

  function save() {
    setDisplayName(name);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Shell title="설정">
      <Card className="mt-4 p-5">
        <h2 className="flex items-center gap-2 text-[16px] font-extrabold">
          <UserRound size={18} className="text-mint-400" /> 통화 표시 이름
        </h2>
        {user ? (
          <p className="mt-2 text-[14px] leading-relaxed text-mist-500">
            로그인 상태에서는 계정 아이디(<b className="text-white">{user.username}</b>)가
            그대로 표시됩니다.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <Field
              label="이름 (방 입장 시 자동 사용)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 운전자A"
              maxLength={20}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
            />
            <Button onClick={save}>
              <Check size={17} /> {saved ? '저장됨!' : '저장'}
            </Button>
          </div>
        )}
      </Card>

      {user && (
        <Card className="mt-3 flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mint-400 text-[18px] font-extrabold text-[#052e1b]">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex-1 text-[15px] font-bold">{user.username}</span>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-1 rounded-xl bg-white/8 px-3 py-2 text-[13px] font-bold text-mist-300"
          >
            <LogOut size={14} /> 로그아웃
          </button>
        </Card>
      )}
    </Shell>
  );
}
