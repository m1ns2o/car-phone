# CarPhone 배포 가이드 — Ubuntu 서버 + 외부 IP + Cloudflare 프록시 + Caddy (Docker 불필요)

## 구성 (확정)

```text
사용자
 ├─ 웹 (HTTPS) ──→ Cloudflare Pages (무료, 자동 HTTPS)
 └─ API/WSS ──→ api.<도메인> (Cloudflare A, 프록시 ON 주황구름)
                  ──→ Ubuntu 서버 외부 IP :80/:443 (UFW: Cloudflare 대역만 허용)
                      ├─ caddy (apt 설치, Let's Encrypt 자동 발급 + 리버스프록시)
                      └─ carphone.service (systemd, Node 22 + SQLite 단일 파일)
```

- 오리진 IP는 DNS에 노출되지 않음 + 방화벽에서 Cloudflare 대역만 허용 → 직접 타격 불가
- e2-micro(1GB) 예상 사용량: server 80~180MB + caddy 30~50MB = **합계 150~250MB**
- DB는 SQLite 단일 파일 (`/opt/carphone/data/carphone.db`, WAL). 백업 = 파일 복사.

## 0. 사전 준비

- Ubuntu 22.04/24.04 서버 + 외부 IP + 루트(sudo) 권한
- 도메인 1개 → Cloudflare 네임서버 등록 → A레코드 `api` → 서버 IP, **프록시 ON**
- Cloudflare SSL/TLS → 암호화 모드 **Full (Strict)**
- Google OAuth 승인 원본에 `https://<웹도메인>` 추가
- 코드가 Git 원격저장소에 푸시되어 있어야 함 (스크립트가 clone/pull)

## 1. 한 방 설치

```bash
scp scripts/setup-ubuntu.sh user@서버:/tmp/
ssh user@서버
sudo DOMAIN=api.<도메인> REPO_URL=https://github.com/xxx/carphone.git bash /tmp/setup-ubuntu.sh
```

스크립트가 순서대로 수행 (재실행 안전 — 업데이트도 같은 명령):

1. `curl/git/빌드도구/openssl/ufw` 설치
2. Node.js 22 (없을 때만) + pnpm 활성화
3. Caddy 설치 (없을 때만)
4. `carphone` 시스템 유저 생성 + `/opt/carphone`에 clone (있으면 `pull --hard`)
5. `pnpm install` + 서버 빌드
6. `/opt/carphone/.env` 생성 — JWT 3종 `openssl` 자동 발급, **재실행 시 기존 유지**
7. systemd 등록·기동 (`MemoryMax=400M`, 실패 시 3초 후 재시작)
8. `/etc/caddy/Caddyfile` 작성 + reload (인증서 자동 발급)
9. UFW: SSH 유지 + **Cloudflare 대역만 80/443 허용**
10. 헬스체크: `127.0.0.1:3000` 즉시 + `https://api.<도메인>` (DNS·인증서에 수 분 소요)

추가 변수: `BRANCH=main` (기본값), `GOOGLE_CLIENT_ID=...` (기본값 내장, 다르면 지정).

## 2. 운영 명령

```bash
systemctl status carphone caddy
journalctl -u carphone -f            # 서버 로그
journalctl -u caddy -f               # 프록시 로그
curl https://api.<도메인>/api/health # → {"ok":true}

# 업데이트 배포 (코드 푸시 후):
sudo DOMAIN=api.<도메인> REPO_URL=... bash /tmp/setup-ubuntu.sh

# DB 백업 (cron 권장):
cp /opt/carphone/data/carphone.db ~/backup-$(date +%F).db
```

## 3. 웹 배포 (Cloudflare Pages)

운영: `https://carphone.pages.dev` (직접 업로드, GitHub 연동 불필요).
재배포: `pnpm --filter @carphone/web build` 후
`wrangler pages deploy apps/web/dist --project-name=carphone --branch=main`.
빌드 시 환경변수: `VITE_API_URL=https://carphone-api.m1ns2o.com`,
`VITE_WS_URL=wss://carphone-api.m1ns2o.com/ws`, `VITE_GOOGLE_CLIENT_ID=<동일 ID>`.
(커스텀 `car-phone.m1ns2o.com`은 CNAME → `carphone.pages.dev` 추가 시 활성화 — 선택)

## 4. 검증 체크리스트

- [ ] `https://api.<도메인>/api/health` → `{"ok":true}`
- [ ] Google 로그인 → 친구 추가 → 통화
- [ ] 25s heartbeat로 장시간 대기 후 수신 모달 정상
- [ ] 초대링크 게스트 입장

## TURN (나중에 P2P 실패율이 나올 때)

- **현재: TURN 미구현, STUN-only P2P.** `iceConfig.ts`가 `VITE_TURN_*`을 자동 인식하므로 클라이언트 코드는 손댈 필요 없음.
- 켜는 법:
  1. DNS에 `turn` A레코드 (**DNS-only**, UDP는 프록시 불가) + UFW에 `3478/tcp·udp`, `49160-49200/udp` 허용
  2. `coturn` 설치 후 `/etc/turnserver.conf`에 realm·계정 설정 → `systemctl enable coturn`
  3. Pages에 `VITE_TURN_URL=turn:turn.<도메인>:3478` (+USERNAME/CREDENTIAL) → 재배포
