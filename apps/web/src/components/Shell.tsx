import { Link, useLocation } from 'react-router-dom';
import { PhoneCall, FlaskConical, House, Users, Clock, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

// 앱 프레임: 데스크탑에서는 430px 폰 프레임 + ambient glow, 모바일은 풀스크린
export function Shell({ children, title, hideNav = false }: { children: ReactNode; title: string; hideNav?: boolean }) {
  const loc = useLocation();
  return (
    <div className="min-h-dvh bg-night-950 text-white">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full bg-mint-500/15 blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 h-56 w-[480px] -translate-x-1/2 rounded-full bg-sky-300/8 blur-[90px]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-4 pb-28 pt-4">
        <header className="flex items-center gap-2 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-400/15">
            <PhoneCall size={18} className="text-mint-400" />
          </span>
          <h1 className="flex-1 text-[17px] font-extrabold tracking-tight">{title}</h1>
          <Link to="/settings" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/6 text-mist-300" aria-label="settings">
            <Settings2 size={17} />
          </Link>
          <Link to="/debug" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/6 text-mist-300" aria-label="debug">
            <FlaskConical size={17} />
          </Link>
        </header>

        <main className="flex-1">{children}</main>

        {!hideNav && (
          <nav className="fixed bottom-4 left-1/2 w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2">
            <div className="flex items-center gap-1 rounded-3xl border border-white/8 bg-night-800/90 p-1.5 shadow-2xl backdrop-blur">
              <NavBtn to="/" active={loc.pathname === '/'} icon={<House size={17} />} label="홈" />
              <NavBtn to="/friends" active={loc.pathname === '/friends'} icon={<Users size={17} />} label="친구" />
              <NavBtn to="/history" active={loc.pathname === '/history'} icon={<Clock size={17} />} label="기록" />
              <NavBtn to="/debug" active={loc.pathname === '/debug'} icon={<FlaskConical size={17} />} label="진단" />
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

function NavBtn({ to, active, icon, label }: { to: string; active: boolean; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[14px] font-bold',
        active ? 'bg-mint-400 text-[#052e1b]' : 'text-mist-500',
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
