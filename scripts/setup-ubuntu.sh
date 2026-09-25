#!/usr/bin/env bash
#
# CarPhone 프로덕션 원샷 설치 (Ubuntu 22.04/24.04, Docker 불필요)
#
#   sudo DOMAIN=api.example.com REPO_URL=https://github.com/xxx/carphone.git ./scripts/setup-ubuntu.sh
#
# 하는 일: Node 22 + Caddy + 앱 빌드 + systemd 등록 + UFW(Cloudflare만 80/443) + 기동 + 헬스체크
# 재실행해도 안전 (멱등): git pull → 재빌드 → 재시작. JWT 시크릿은 기존 .env 유지.
#
set -euo pipefail

DOMAIN="${DOMAIN:?DOMAIN을 지정하세요. 예: sudo DOMAIN=api.example.com ...}"
REPO_URL="${REPO_URL:?REPO_URL을 지정하세요. 예: sudo REPO_URL=https://github.com/xxx/carphone.git ...}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-611282380522-rbu3klsjoh8i8uisb0vnaa546ib8b6u0.apps.googleusercontent.com}"
BRANCH="${BRANCH:-main}"

APP_DIR="/opt/carphone"
SERVICE_USER="carphone"
DATA_DIR="/opt/carphone/data"

log() { echo "==> $*"; }

if [[ $EUID -ne 0 ]]; then
  echo "루트로 실행하세요: sudo $0" >&2
  exit 1
fi

# ---------- 1. 기본 패키지 ----------
log "기본 패키지 설치"
apt-get update -qq
apt-get install -y -qq curl git build-essential python3 openssl ufw ca-certificates debian-keyring debian-archive-keyring apt-transport-https > /dev/null

# ---------- 2. Node.js 22 ----------
if ! command -v node > /dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]]; then
  log "Node.js 22 설치"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null
  apt-get install -y -qq nodejs > /dev/null
fi
log "node $(node -v)"
corepack enable || true
corepack prepare pnpm@10.33.2 --activate > /dev/null 2>&1 || true
log "pnpm $(pnpm -v)"

# ---------- 3. Caddy ----------
if ! command -v caddy > /dev/null; then
  log "Caddy 설치"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq caddy > /dev/null
fi
log "caddy $(caddy version | cut -d' ' -f1)"

# ---------- 4. 서비스 유저 + 앱 코드 ----------
if ! id "$SERVICE_USER" > /dev/null 2>&1; then
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi
if [[ -d "$APP_DIR/.git" ]]; then
  log "코드 업데이트 (git pull)"
  git -C "$APP_DIR" fetch -q origin "$BRANCH"
  git -C "$APP_DIR" checkout -q "$BRANCH"
  git -C "$APP_DIR" reset -q --hard "origin/$BRANCH"
else
  log "코드 클론"
  rm -rf "$APP_DIR"
  git clone -q --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
fi
mkdir -p "$DATA_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR" "$DATA_DIR"

# ---------- 5. 빌드 (root 소유로 한 번만, 실행은 carphone 유저) ----------
log "의존성 설치 + 서버 빌드"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
pnpm --dir "$APP_DIR" install --frozen-lockfile
pnpm --dir "$APP_DIR" --filter @carphone/server build
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

# ---------- 6. 환경파일 (시크릿은 최초 1회 생성, 이후 유지) ----------
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  log "프로덕션 .env 생성 (시크릿 자동 발급)"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
SERVER_PORT=3000
DATA_DIR=$DATA_DIR
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_INVITE_SECRET=$(openssl rand -hex 32)
EOF
  chmod 600 "$ENV_FILE"
else
  log "기존 .env 유지 (시크릿 보존)"
  if ! grep -q GOOGLE_CLIENT_ID "$ENV_FILE"; then
    echo "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" >> "$ENV_FILE"
  fi
fi
chown "$SERVICE_USER:$SERVICE_USER" "$ENV_FILE"

# ---------- 7. systemd 서비스 ----------
log "systemd 등록"
cat > /etc/systemd/system/carphone.service <<EOF
[Unit]
Description=CarPhone signaling server
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR/apps/server
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node --max-old-space-size=320 $APP_DIR/apps/server/dist/index.js
Restart=always
RestartSec=3
MemoryMax=400M
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q carphone
systemctl restart carphone

# ---------- 8. Caddy 리버스프록시 (자동 HTTPS) ----------
log "Caddy 설정 ($DOMAIN)"
cp -f /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%s)" 2>/dev/null || true
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	reverse_proxy 127.0.0.1:3000
}
EOF
systemctl enable -q caddy
systemctl reload-or-restart caddy

# ---------- 9. 방화벽: Cloudflare 대역만 80/443 ----------
# 최신 대역: https://www.cloudflare.com/ips-v4
CF_V4="173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22"
log "UFW 설정 (SSH 유지 + Cloudflare만 웹 허용)"
ufw allow OpenSSH > /dev/null
# 기존 80/443 일반 허용이 있으면 제거 (CF 전용으로 전환)
ufw delete allow 80/tcp > /dev/null 2>&1 || true
ufw delete allow 443/tcp > /dev/null 2>&1 || true
for cidr in $CF_V4; do
  ufw allow from "$cidr" to any port 80,443 proto tcp > /dev/null
done
ufw --force enable > /dev/null

# ---------- 10. 헬스체크 ----------
log "기동 대기 + 헬스체크"
for i in $(seq 1 15); do
  if curl -sf http://127.0.0.1:3000/api/health > /dev/null; then
    break
  fi
  sleep 2
done
curl -sf http://127.0.0.1:3000/api/health
echo
log "외부 확인: curl https://$DOMAIN/api/health  (DNS 전파 + 인증서 발급에 수 분 소요)"
for i in $(seq 1 10); do
  if curl -sf "https://$DOMAIN/api/health" > /dev/null 2>&1; then
    curl -s "https://$DOMAIN/api/health"
    echo
    break
  fi
  sleep 6
done

log "완료. 상태: systemctl status carphone caddy / 로그: journalctl -u carphone -f"
log "DB 백업: cp $DATA_DIR/carphone.db ~/backup-\$(date +%F).db"
