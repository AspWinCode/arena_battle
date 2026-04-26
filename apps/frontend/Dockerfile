FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --workspaces --if-present

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend ./apps/frontend
COPY tsconfig.base.json ./

WORKDIR /app/apps/frontend
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
