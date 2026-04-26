FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++ docker-cli
WORKDIR /app

# Install dependencies
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --workspaces --if-present

# Copy source
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/tsup.config.ts ./apps/backend/
COPY tsconfig.base.json ./

# Generate Prisma client
WORKDIR /app/apps/backend
RUN npx prisma generate

# Build
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache docker-cli
WORKDIR /app

COPY --from=base /app/apps/backend/dist ./dist
COPY --from=base /app/apps/backend/node_modules ./node_modules
COPY --from=base /app/apps/backend/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
