# 🤖 RoboCode Arena

**Образовательная игровая платформа для обучения программированию через PvP-битвы.**

Игроки пишут код (JS / Python / C++ / Java) или собирают программы из блоков — и их персонажи автоматически сражаются на арене в реальном времени.

---

## 🏗 Архитектура

```
robocode-arena/
├── apps/
│   ├── frontend/          React 18 + TypeScript + Vite
│   └── backend/           Node.js 20 + Fastify 4 + Prisma 5
├── packages/
│   └── shared/            Общие типы (Strategy, ServerMessage, ...)
├── docker/
│   ├── sandbox-python/    Docker-контейнер для Python кода
│   ├── sandbox-cpp/       Docker-контейнер для C++ кода
│   └── sandbox-java/      Docker-контейнер для Java кода
└── docker-compose.yml
```

### Стек технологий

| Слой            | Технология                    |
|-----------------|-------------------------------|
| Frontend        | React 18, TypeScript 5, Vite  |
| Блочный редактор| Custom Canvas/SVG (без Blockly)|
| Код-редактор    | Monaco Editor                 |
| Анимация арены  | SVG + Canvas API (60 FPS)     |
| Backend         | Node.js 20, Fastify 4         |
| WebSocket       | @fastify/websocket            |
| Sandbox JS      | isolated-vm 4                 |
| Sandbox Py/C++/Java | Docker (изолированные контейнеры) |
| База данных     | PostgreSQL 15 + Prisma 5      |
| Auth            | JWT (Admin) + SessionCode (Players) |
| Деплой          | Docker Compose + Nginx        |
| CI/CD           | GitHub Actions                |

---

## 🚀 Быстрый старт (разработка)

### 1. Предварительные требования

- Node.js 20+
- PostgreSQL 15+ (или Docker)
- Docker (для sandbox-контейнеров)

### 2. Установка

```bash
git clone https://github.com/your-org/robocode-arena
cd robocode-arena
npm install
```

### 3. Настройка окружения

```bash
cp .env.example apps/backend/.env
# Отредактируй apps/backend/.env — укажи DATABASE_URL, JWT_SECRET и т.д.
```

### 4. База данных

```bash
# Поднять PostgreSQL через Docker (если нет локального)
docker run -d --name robocode-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=robocode \
  -p 5432:5432 postgres:15-alpine

# Применить схему
make db-push
```

### 5. Запуск dev-сервера

```bash
make dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
# API docs: http://localhost:3001/health
```

### 6. Создать первого Admin

```bash
make seed-admin
# Email: admin@robocode.io  Password: admin123
```

---

## 🐳 Деплой через Docker Compose

```bash
# Собрать sandbox-образы
make sandboxes

# Локальный Docker-запуск
make docker-up

# Создать admin
make seed-admin
```

Локально по умолчанию frontend доступен на `http://localhost:8080`, backend на `http://localhost:3001`.

Если порты на машине уже заняты, можно переопределить их через `.env`:

```bash
FRONTEND_PORT=18080
BACKEND_PORT=13001
POSTGRES_PORT=15432
```

Для VPS используется отдельный override:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

В production базовый `docker-compose.yml` не публикует конфликтующие порты наружу. Наружу выставляется только порт frontend из `FRONTEND_PORT` (по умолчанию `8080`), а host nginx проксирует на него.

---

## 🎮 Пользовательский сценарий

### Admin (Учитель)

1. Зайти на `/admin` → войти
2. **Создать сессию** (`/admin/session/new`):
   - Название: "Урок 3, 6А класс"
   - Уровень: CODE / BLOCKS / PRO
   - Формат: BO1 / BO3 / BO5
   - Время: 10 мин
3. Скопировать **два кода** (напр. `XK9P2Q` и `JM4R7T`)
4. Раздать коды двум игрокам

### Игрок

1. Открыть `/join`
2. Ввести имя + код сессии + выбрать скина
3. Ждать подключения противника
4. Написать код (или собрать из блоков) + нажать **ГОТОВ К БОЮ**
5. Наблюдать за анимированным боем на арене

---

## 📡 WebSocket протокол

```
Client → Server:
  connect   { playerCode, name, skin }
  ready     { code, lang }
  ping      {}

Server → Client:
  connected      { slot, sessionLevel, allowedSkins }
  lobby_update   { p1, p2 }
  coding_start   { timeLimit }
  timer_tick     { remaining }
  battle_start   { round, p1, p2 }
  turn_result    { turn, p1Action, p2Action, p1DmgTaken, ... }
  round_end      { round, winner, p1Hp, p2Hp, reason }
  match_end      { winner, score, rounds }
```

---

## ⚔️ Battle Engine

Движок работает по **матрице урона** (6×6 действий):

| Атака↓ / Защита→ | attack | laser | shield | dodge | combo | repair |
|------------------|--------|-------|--------|-------|-------|--------|
| **attack**       | -15/-15| -15/-15| -8/0  | 0/0   | -10/-22| 0/-20 |
| **laser**        | 0/-25  | -25/-25| 0/-20 | 0/0*  | -5/-25 | 0/-30 |
| **shield**       | -8/0   | 0/-20  | 0/0   | 0/0   | 0/-10  | 0/0   |
| **dodge**        | 0/0    | 0/0    | 0/0   | 0/0*  | 0/-12  | 0/0   |
| **combo**        | -22/-10| -25/-5 | 0/-10 | -12/0 | -20/-20| 0/-25 |
| **repair**       | -20/0  | -30/0  | 0/0   | 0/0   | -25/0  | 0/0 (+20HP)|

`*` = 50% шанс промаха

---

## 🔒 Безопасность Sandbox

| Угроза | Защита |
|--------|--------|
| Бесконечный цикл | Timeout 5 сек → docker kill |
| Утечка памяти | Memory limit 32 MB |
| Сетевые запросы | NetworkDisabled: true |
| Запись на диск | ReadonlyRootfs: true |
| Root-привилегии | USER sandbox (uid 1001), CapDrop ALL |
| Fork-бомба | PidsLimit: 50 |
| Большой код | Лимит 5000 символов |

---

## 🧪 Тесты

```bash
npm run test                          # все тесты
npm run test --workspace=apps/backend # только backend
```

---

## 📁 Ключевые файлы

| Файл | Назначение |
|------|------------|
| `packages/shared/src/types.ts` | Все общие TypeScript типы |
| `packages/shared/src/game.ts`  | Матрица урона, константы |
| `apps/backend/src/engine/battle-engine.ts` | Движок боя |
| `apps/backend/src/ws/session-room.ts` | WebSocket логика |
| `apps/backend/src/sandbox/sandbox-service.ts` | Оркестратор sandbox |
| `apps/frontend/src/components/Arena/ArenaComponent.tsx` | SVG-арена |
| `apps/frontend/src/components/Arena/VFXCanvas.tsx` | Частицы и эффекты |
| `apps/frontend/src/components/BlockEditor/BlockEditor.tsx` | Блочный редактор |

---

## 🗺 Роадмап (Фаза 2)

- [ ] Командные режимы (2v2, 3v3)
- [ ] Постоянные аккаунты + OAuth
- [ ] Рейтинги и турниры
- [ ] Мобильное приложение
- [ ] Режим обучения (10 миссий)
- [ ] Реплеи боёв
- [ ] Кастомные арены

---

## 📄 Лицензия

MIT © RoboCode Arena Team
