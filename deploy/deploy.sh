#!/bin/bash
set -euo pipefail

DOMAIN="${DOMAIN:-arenabattle.tirskix.space}"
APP_DIR="${APP_DIR:-/opt/arena_battle}"
REPO="${REPO:-https://github.com/AspWinCode/arena_battle.git}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"

echo "========================================"
echo "  RoboCode Arena VPS deploy"
echo "  Domain: ${DOMAIN}"
echo "  Frontend port: ${FRONTEND_PORT}"
echo "========================================"

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "Docker already installed"
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "Installing certbot..."
  apt-get update -qq
  apt-get install -y -qq certbot python3-certbot-nginx
fi

echo "Syncing repository..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git pull
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

if [ ! -f .env ]; then
  echo "Generating .env..."
  POSTGRES_PASSWORD="$(openssl rand -hex 16)"
  JWT_SECRET="$(openssl rand -hex 32)"
  COOKIE_SECRET="$(openssl rand -hex 32)"

  cat > .env <<EOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/robocode
JWT_SECRET=${JWT_SECRET}
COOKIE_SECRET=${COOKIE_SECRET}
FRONTEND_URL=https://${DOMAIN}
FRONTEND_PORT=${FRONTEND_PORT}
NODE_ENV=production
LOG_LEVEL=warn
SANDBOX_PYTHON_IMAGE=robocode/sandbox-python:latest
SANDBOX_CPP_IMAGE=robocode/sandbox-cpp:latest
SANDBOX_JAVA_IMAGE=robocode/sandbox-java:latest
EOF
  echo ".env created"
else
  echo ".env already exists"
fi

echo "Building and starting containers..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "Waiting for backend health..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend wget -qO- http://localhost:3001/health >/dev/null 2>&1; then
    echo "Backend is ready"
    break
  fi
  sleep 2
done

echo "Configuring nginx..."
sed \
  -e "s/__DOMAIN__/${DOMAIN}/g" \
  -e "s/__FRONTEND_PORT__/${FRONTEND_PORT}/g" \
  deploy/nginx-arena.conf > /etc/nginx/sites-available/arena-battle

cat > /etc/nginx/sites-available/arena-battle-tmp <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    location / { return 200 'ok'; }
}
EOF

ln -sf /etc/nginx/sites-available/arena-battle-tmp /etc/nginx/sites-enabled/arena-battle
nginx -t && systemctl reload nginx

echo "Requesting SSL certificate..."
certbot certonly --nginx -d "$DOMAIN" \
  --non-interactive --agree-tos \
  --email "admin@tirskix.space" \
  --redirect

ln -sf /etc/nginx/sites-available/arena-battle /etc/nginx/sites-enabled/arena-battle
rm -f /etc/nginx/sites-available/arena-battle-tmp
nginx -t && systemctl reload nginx

echo ""
echo "Creating first admin..."
sleep 3
curl -sf -X POST "http://127.0.0.1:${FRONTEND_PORT}/api/v1/auth/seed-admin" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@robocode.io","password":"admin123"}' | cat

echo ""
echo "========================================"
echo "  Ready"
echo "  https://${DOMAIN}"
echo "  admin@robocode.io / admin123"
echo "  Change the password after first login"
echo "========================================"
