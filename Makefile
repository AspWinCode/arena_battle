.PHONY: install dev build test docker-up docker-down sandboxes seed-admin

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

# Docker
docker-up:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

docker-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

docker-build:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml build

# Sandbox images
sandboxes:
	docker build -t robocode/sandbox-python:latest ./docker/sandbox-python
	docker build -t robocode/sandbox-cpp:latest    ./docker/sandbox-cpp
	docker build -t robocode/sandbox-java:latest   ./docker/sandbox-java

# Create first admin (dev only)
seed-admin:
	curl -s -X POST http://localhost:3001/api/v1/auth/seed-admin \
	  -H "Content-Type: application/json" \
	  -d '{"email":"admin@robocode.io","password":"admin123"}' | jq .

# DB
db-push:
	cd apps/backend && npx prisma db push

db-studio:
	cd apps/backend && npx prisma studio

db-migrate:
	cd apps/backend && npx prisma migrate dev
