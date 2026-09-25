# CarPhone — 1:1 WebRTC 음성통화 MVP (Phase 3~4: 계정·친구·통화기록)

## 구성
- `apps/web` — React+Vite 통화 UI (`/`, `/call/:roomId`, `/debug`, `/login`, `/signup`, `/friends`, `/history`)
- `apps/server` — Fastify + WebSocket 시그널링 relay (음성은 P2P, 서버 경유 X) + REST (auth/users/friends/calls)
- `packages/shared` — 시그널링/API 타입 단일 진실원천
- `packages/webrtc` — `RTCPeerConnection`/`getUserMedia`/ICE 설정 공용 로직
- `packages/api` — REST/WS base + health client (RN 재사용)

## 빠른 시작 (PC)
```bash
cp .env.example .env
pnpm install
pnpm --filter @carphone/server dev   # :3000 (SQLite ./data 자동 생성)
pnpm --filter @carphone/web dev      # :5173
# 비로그인: http://localhost:5173 에서 방 입장 → 다른 브라우저에서 같은 방 ID로 입장 → 통화 시작
# 로그인: /signup → /friends 에서 친구 추가·수락 → 전화 버튼 → 상대방에 수신 모달 → 수락 → 통화
```

## Android 실기 테스트 (HTTPS 필수)
`getUserMedia`는 Secure Context에서만 동작. `http://192.168.x.x` 직접 접속은 실패함.

**권장: Cloudflare Tunnel**
```bash
# web+server가 로컬에서 실행 중일 때
cloudflared tunnel --url http://localhost:5173
# 발급된 https://xxx.trycloudflare.com 을 폰 Chrome에서 열기
# /debug에서 마이크 테스트 → /call/abc 로 2대 입장
```
- Vite proxy가 `/api`, `/ws`를 `:3000`으로 넘기므로 터널 1개면 됨.
- PC Chrome + Android Chrome 같은 방 ID로 입장.

## Android Auto 검증 체크리스트
1. `/debug` — audioinput 개수, 라벨, getSettings 기록
2. `/call/{roomId}` — 5/10/20분 통화, 화면의 `pc/ice` 상태 + 5초 간격 stats 로그(rtt/jitter/lost) 기록
3. 폰을 AA 연결 → 차량 스피커 출력 O/X
4. TMAP/카카오맵 안내와 동시 재생 → ducking O/X 기록
5. 다른 앱 전환 → 잠금 → 복귀 시 연결 유지 여부

## 스크립트
- `pnpm dev` — web+server 동시 실행
- `pnpm typecheck` — 전 패키지 타입체크 (개별: `pnpm --filter ... typecheck`)

## 다음 단계 (P2→P3)
- [ ] TURN 자리 활성화 (`packages/webrtc/src/iceConfig.ts`)
- [ ] JWT auth + WS 인증 + 친구관계 검증
- [ ] Drizzle + Postgres 마이그레이션 (users/friend_requests/friendships/calls)
