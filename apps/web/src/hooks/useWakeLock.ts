import { useEffect, useRef } from 'react';

// 통화 중 화면 꺼짐 방지. 백그라운드 실행을 보장하지는 않음 (명세대로).
export function useWakeLock(active: boolean) {
  const lockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function acquire() {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
        };
        if (!active || !nav.wakeLock) return;
        const lock = await nav.wakeLock.request('screen');
        if (cancelled) {
          await lock.release();
          return;
        }
        lockRef.current = lock;
      } catch {
        // 미지원/거부 시 무시
      }
    }
    if (active) void acquire();
    return () => {
      cancelled = true;
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);

  return lockRef;
}
