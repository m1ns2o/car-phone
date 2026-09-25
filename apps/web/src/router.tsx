import { useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CallPage } from './pages/CallPage';
import { DebugPage } from './pages/DebugPage';
import { LoginPage } from './pages/LoginPage';
import { FriendsPage } from './pages/FriendsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { IncomingCallListener } from './components/IncomingCallListener';
import { useAuth } from './stores/auth';

function Boot() {
  const checkMe = useAuth((s) => s.checkMe);
  useEffect(() => {
    void checkMe();
  }, [checkMe]);
  return (
    <>
      <IncomingCallListener />
      <Outlet />
    </>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    if (ready && !user) nav('/login', { replace: true, state: { from: loc.pathname } });
  }, [ready, user, nav, loc.pathname]);
  if (!ready) return <div className="flex min-h-dvh items-center justify-center bg-night-950 text-mist-500">불러오는 중…</div>;
  if (!user) return null;
  return <>{children}</>;
}

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    element: <Boot />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/call/:roomId', element: <CallPage /> },
      { path: '/debug', element: <DebugPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <Navigate to="/login" replace /> },
      { path: '/friends', element: <RequireAuth><FriendsPage /></RequireAuth> },
      { path: '/history', element: <RequireAuth><HistoryPage /></RequireAuth> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
