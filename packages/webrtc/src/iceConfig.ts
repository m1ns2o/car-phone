// ICE 설정 — P2P 우선. STUN 기본, TURN은 폴백(대칭형 NAT 등 P2P 실패 시 중계).
// TURN 환경변수만 채우면 코드 수정 없이 활성화됨 (MVP에서는 미사용).
export interface TurnConfig {
  url: string;
  username: string;
  credential: string;
}

function viteEnv(): Record<string, string> {
  try {
    return (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  } catch {
    return {};
  }
}

export function buildIceConfig(opts?: {
  stunUrl?: string;
  turn?: TurnConfig;
}): RTCConfiguration {
  const env = viteEnv();
  const stunUrl = opts?.stunUrl || env.VITE_STUN_URL || 'stun:stun.l.google.com:19302';

  const iceServers: RTCIceServer[] = [{ urls: stunUrl }];

  // 명시적 opts 우선, 없으면 VITE_TURN_* 환경변수 (Pages/빌드 시 주입)
  const turn = opts?.turn ??
    (env.VITE_TURN_URL
      ? { url: env.VITE_TURN_URL, username: env.VITE_TURN_USERNAME ?? '', credential: env.VITE_TURN_CREDENTIAL ?? '' }
      : undefined);
  if (turn?.url) {
    iceServers.push({
      urls: turn.url,
      username: turn.username,
      credential: turn.credential,
    });
  }

  return { iceServers };
}
