#!/bin/bash
# deploy.sh — разворачивает RoboCode Arena на VPS
# Не трогает другие проекты и существующий nginx
set -e

DOMAIN="arenabattle.tirskix.space"
APP_DIR="/opt/arena_battle"
REPO="https://github.com/AspWinCode/arena_battle.git"

echo "════════════════════════════════════════"
echo "  RoboCode Arena — VPS deploy"
echo "  Domain: $DOMAIN"
echo "════════════════════════════════════════"

# ── 1. Docker ────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "▶ Устанавливаем Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "✓ Docker уже установлен"
fi

# ── 2. Certbot (если нет) ────────────────────
if ! command -v certbot &>/dev/null; then
  echo "▶ Устанавливаем certbot..."
  apt-get update -qq
  apt-get install -y -qq certbot python3-certbot-nginx
fi

# ── 3. Клонируем репо ────────────────────────
echo "▶ Клонируем репозиторий..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" && git pull
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi
cd "$APP_DIR"

# ── 4. .env ──────────────────────────────────
if [ ! -f .env ]; then
  echo "▶ Генерируем .env..."
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -hex 32)
  COOKIE_SECRET=$(openssl rand -hex 32)

  cat > .env <<EOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/robocode
JWT_SECRET=${JWT_SECRET}
COOKIE_SECRET=${COOKIE_SECRET}
FRONTEND_URL=https://${DOMAIN}
NODE_ENV=production
LOG_LEVEL=warn
SANDBOX_PYTHON_IMAGE=robocode/sandbox-python:latest
SANDBOX_CPP_IMAGE=robocode/sandbox-cpp:latest
SANDBOX_JAVA_IMAGE=robocode/sandbox-java:latest
EOF
  echo "✓ .env создан"
else
  echo "✓ .env уже существует, пропускаем"
fi

# ── 5. Запуск контейнеров ────────────────────
echo "▶ Собираем и запускаем контейнеры..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "▶ Ждём запуска backend..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001/health &>/dev/null; then
    echo "✓ Backend готов"
    break
  fi
  sleep 2
done

# ── 6. Nginx ─────────────────────────────────
echo "▶ Настраиваем nginx..."
cp deploy/nginx-arena.conf /etc/nginx/sites-available/arena-battle

# Временный HTTP-блок для получения сертификата
cat > /etc/nginx/sites-available/arena-battle-tmp <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    location / { return 200 'ok'; }
}
EOF
ln -sf /etc/nginx/sites-available/arena-battle-tmp /etc/nginx/sites-enabled/arena-battle
nginx -t && systemctl reload nginx

# ── 7. SSL ───────────────────────────────────
echo "▶ Получаем SSL сертификат..."
certbot certonly --nginx -d "$DOMAIN" \
  --non-interactive --agree-tos \
  --email "admin@tirskix.space" \
  --redirect

# Переключаем на продакшн конфиг
ln -sf /etc/nginx/sites-available/arena-battle /etc/nginx/sites-enabled/arena-battle
rm -f /etc/nginx/sites-available/arena-battle-tmp
nginx -t && systemctl reload nginx

# ── 8. Первый admin ──────────────────────────
echo ""
echo "▶ Создаём первого admin..."
sleep 3
curl -sf -X POST http://localhost:3001/api/v1/auth/seed-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@robocode.io","password":"admin123"}' | cat

echo ""
echo "════════════════════════════════════════"
echo "  ✅ Готово!"
echo "  🌐 https://${DOMAIN}"
echo "  👤 admin@robocode.io / admin123"
echo "  ⚠️  Смени пароль после первого входа!"
echo "════════════════════════════════════════"
