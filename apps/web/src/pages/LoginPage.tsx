import { Shell } from '../components/Shell';
import { Card } from '../components/ui';
import { GoogleButton } from '../components/GoogleButton';

// Google 로그인 전용 — ID/비밀번호 폼 없음
export function LoginPage() {
  return (
    <Shell title="로그인">
      <Card className="mt-4 p-6 text-center">
        <h2 className="text-[22px] font-extrabold tracking-tight">간편하게 시작하세요</h2>
        <p className="mt-1 text-[13px] text-mist-500">Google 계정으로 로그인하면 친구에게 바로 전화를 걸 수 있습니다.</p>
        <div className="mt-5">
          <GoogleButton />
        </div>
      </Card>
    </Shell>
  );
}
