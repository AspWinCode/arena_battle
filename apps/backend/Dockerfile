FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++ docker-cli
WORKDIR /app

# ── Зависимости (кешируем слой) ───────────────
COPY package.json ./
COPY apps/backend/package.json  ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --workspaces --if-present

# ── Исходники shared ──────────────────────────
COPY packages/shared/src        ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

# ── Сборка shared → dist/index.mjs + dist/index.js ──
RUN npm run build --workspace=packages/shared

# ── Исходники backend ─────────────────────────
COPY apps/backend/src           ./apps/backend/src
COPY apps/backend/prisma        ./apps/backend/prisma
COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/tsup.config.ts ./apps/backend/
COPY tsconfig.base.json         ./

# ── Prisma generate ───────────────────────────
WORKDIR /app/apps/backend
RUN npx prisma generate

# ── Сборка backend ────────────────────────────
RUN npm run build

# ─────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache docker-cli
WORKDIR /app

# Копируем root node_modules (npm workspaces кладёт всё сюда)
COPY --from=base /app/node_modules        ./node_modules

# Собранный backend
COPY --from=base /app/apps/backend/dist   ./dist
COPY --from=base /app/apps/backend/prisma ./prisma

# Shared dist нужен runtime (symlink из node_modules/@robocode/shared)
COPY --from=base /app/packages/shared/dist          ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json  ./packages/shared/package.json

# package.json нужен для workspace-резолвинга
COPY --from=base /app/apps/backend/package.json ./package.json
COPY --from=base /app/package.json              ./root-package.json

ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss && node dist/index.js"]
