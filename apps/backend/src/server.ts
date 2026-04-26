import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyWebsocket from '@fastify/websocket'

import { authRoutes } from './routes/auth.js'
import { sessionRoutes } from './routes/sessions.js'
import { resultRoutes } from './routes/results.js'
import { wsRoutes } from './ws/index.js'

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

  // Decorators
  server.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })

  // Routes
  await server.register(authRoutes, { prefix: '/api/v1/auth' })
  await server.register(sessionRoutes, { prefix: '/api/v1/session' })
  await server.register(resultRoutes, { prefix: '/api/v1/session' })
  await server.register(wsRoutes, { prefix: '/ws' })

  server.get('/health', async () => ({ status: 'ok', ts: Date.now() }))

  return server
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
