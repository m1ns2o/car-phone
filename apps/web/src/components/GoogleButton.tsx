import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, setToken } from '@carphone/api';
import { useAuth } from '../stores/auth';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID ?? '';

/**
 * Google Identity Services 버튼.
 * 필요 조건: Google Cloud Console → OAuth Client ID(웹) → 승인된 JS 원본에 http://localhost:5173 등록
 * → .env에 VITE_GOOGLE_CLIENT_ID=<같은 ID> 설정 후 웹 재시작.
 */
export function GoogleButton() {
  const nav = useNavigate();
  const checkMe = useAuth((s) => s.checkMe);
  const divRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    const ready = () =>
      new Promise<void>((resolve) => {
        if (window.google?.accounts?.id) return resolve();
        const script = document.querySelector('script[data-gis]') as HTMLScriptElement | null;
        if (script) {
          script.addEventListener('load', () => resolve(), { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.dataset.gis = '1';
        s.onload = () => resolve();
        document.head.appendChild(s);
      });

    void ready().then(() => {
      if (cancelled || !divRef.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => {
          void (async () => {
            try {
              const res = await authApi.google(resp.credential);
              setToken(res.data.accessToken);
              await checkMe();
              nav('/friends');
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Google 로그인 실패');
            }
          })();
        },
      });
      window.google.accounts.id.renderButton(divRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [checkMe, nav]);

  if (!CLIENT_ID) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-[12px] leading-relaxed text-mist-500">
        Google 로그인을 쓰려면 <b className="text-white">VITE_GOOGLE_CLIENT_ID</b>를 .env에 설정하세요
        (아래 순서 참고).
      </p>
    );
  }

  return (
    <div>
      <div ref={divRef} className="flex justify-center" />
      {err && <p className="mt-2 text-center text-[13px] font-semibold text-rose-500">⚠️ {err}</p>}
    </div>
  );
}
