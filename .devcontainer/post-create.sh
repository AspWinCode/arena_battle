#!/bin/bash
set -e

echo "──────────────────────────────────────────"
echo "  RoboCode Arena — Codespace setup"
echo "──────────────────────────────────────────"

# ── 1. Зависимости ────────────────────────────
echo "▶ npm install..."
npm install

# ── 2. .env для бэкенда ───────────────────────
echo "▶ Настройка .env..."
cp apps/backend/.env.example apps/backend/.env

# Заменяем DATABASE_URL на локальный Postgres (пароль postgres из features)
sed -i 's|postgresql://postgres:password@localhost:5432/robocode|postgresql://postgres:postgres@localhost:5432/robocode|g' \
    apps/backend/.env

# Генерируем случайные секреты
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
COOKIE_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
sed -i "s|change-this-to-a-long-random-string-in-production|${JWT_SECRET}|g" apps/backend/.env
sed -i "s|change-this-to-another-long-random-string|${COOKIE_SECRET}|g" apps/backend/.env

# Vite dev-сервер должен слушать 0.0.0.0 чтобы работал проброс порта
echo "VITE_API_URL=" >> apps/frontend/.env 2>/dev/null || true

# ── 3. Ждём PostgreSQL ────────────────────────
echo "▶ Ожидаем PostgreSQL..."
for i in $(seq 1 30); do
  if pg_isready -U postgres -q 2>/dev/null; then
    echo "   PostgreSQL готов"
    break
  fi
  sleep 1
done

# Создаём БД если не существует
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='robocode'" | grep -q 1 \
  || psql -U postgres -c "CREATE DATABASE robocode;"

# ── 4. Prisma ─────────────────────────────────
echo "▶ prisma generate + db push..."
cd apps/backend
npx prisma generate
npx prisma db push --accept-data-loss
cd ../..

# ── 5. Сборка shared ──────────────────────────
echo "▶ Build shared package..."
npm run build --workspace=packages/shared

echo ""
echo "✅ Готово! Запускай:"
echo "   npm run dev"
echo ""
echo "   Frontend → https://\$CODESPACE_NAME-5173.app.github.dev"
echo "   Backend  → https://\$CODESPACE_NAME-3001.app.github.dev"
echo ""
echo "   Первый admin:"
echo "   curl -s -X POST http://localhost:3001/api/v1/auth/seed-admin \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"admin@robocode.io\",\"password\":\"admin123\"}'"
