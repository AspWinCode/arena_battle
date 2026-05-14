import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyWebsocket from '@fastify/websocket'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'path'
import fs from 'fs'

import { authRoutes } from './routes/auth.js'
import { sessionRoutes } from './routes/sessions.js'
import { resultRoutes } from './routes/results.js'
import { tournamentRoutes } from './routes/tournaments.js'
import { userAuthRoutes } from './routes/userAuth.js'
import { userProfileRoutes } from './routes/userProfile.js'
import { matchmakingRoutes } from './routes/matchmaking.js'
import { notificationRoutes } from './routes/notifications.js'
import { eloHistoryRoutes } from './routes/eloHistory.js'
import { seasonRoutes } from './routes/seasons.js'
import { challengeRoutes } from './routes/challenges.js'
import { clanRoutes } from './routes/clans.js'
import { adminSkinsRoutes } from './routes/adminSkins.js'
import { shopRoutes } from './routes/shop.js'
import { skinsPublicRoutes } from './routes/skinsPublic.js'
import { wsRoutes } from './ws/index.js'
import { checkAndGeneratePendingBrackets, spawnRecurringInstances } from './tournament/tournament-service.js'

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  })

  // Plugins
  await server.register(fastifyCors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  })

  await server.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  })

  await server.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET ?? 'robocode-cookie-secret-change-in-prod',
  })

  await server.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'robocode-jwt-secret-change-in-prod',
    cookie: {
      cookieName: 'refreshToken',
      signed: false,
    },
  })

  await server.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  await server.register(fastifyWebsocket)

  await server.register(fastifyMultipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  })

  // Serve uploaded skin images
  const uploadsDir = process.env.UPLOADS_DIR ?? '/app/uploads'
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  await server.register(fastifyStatic, {
    root:   path.resolve(uploadsDir),
    prefix: '/api/v1/uploads/',
    decorateReply: false,
  })

  // Decorators
  server.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })

  // Routes
  await server.register(authRoutes,       { prefix: '/api/v1/auth' })
  await server.register(sessionRoutes,    { prefix: '/api/v1/session' })
  await server.register(resultRoutes,     { prefix: '/api/v1/session' })
  await server.register(tournamentRoutes, { prefix: '/api/v1/tournament' })
  await server.register(userAuthRoutes,    { prefix: '/api/v1/user/auth' })
  await server.register(userProfileRoutes, { prefix: '/api/v1/user/profile' })
  await server.register(matchmakingRoutes,  { prefix: '/api/v1/matchmaking' })
  await server.register(notificationRoutes, { prefix: '/api/v1/notifications' })
  await server.register(eloHistoryRoutes,   { prefix: '/api/v1/elo-history' })
  await server.register(seasonRoutes,       { prefix: '/api/v1/seasons' })
  await server.register(challengeRoutes,    { prefix: '/api/v1/challenges' })
  await server.register(clanRoutes,         { prefix: '/api/v1/clans' })
  await server.register(adminSkinsRoutes,   { prefix: '/api/v1/admin/skins' })
  await server.register(shopRoutes,         { prefix: '/api/v1/shop' })
  await server.register(skinsPublicRoutes,  { prefix: '/api/v1/skins' })
  await server.register(wsRoutes,           { prefix: '/ws' })

  server.get('/health', async () => ({ status: 'ok', ts: Date.now() }))

  // Cron: check every hour if any tournament needs bracket auto-generation (T-10 days)
  setInterval(() => {
    checkAndGeneratePendingBrackets().catch(e =>
      server.log.error({ err: e }, '[cron] bracket-check failed')
    )
  }, 60 * 60 * 1000)

  // Cron: check every 6h if any recurring tournament needs a new instance spawned
  setInterval(() => {
    spawnRecurringInstances().catch(e =>
      server.log.error({ err: e }, '[cron] recurring-spawn failed')
    )
  }, 6 * 60 * 60 * 1000)

  return server
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
