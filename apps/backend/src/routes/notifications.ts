import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /notifications — list recent notifications (last 30)
  fastify.get('/', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const notifications = await prisma.notification.findMany({
      where:   { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take:    30,
    })
    return reply.send(notifications)
  })

  // GET /notifications/unread-count
  fastify.get('/unread-count', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const count = await prisma.notification.count({
      where: { userId: payload.userId, read: false },
    })
    return reply.send({ count })
  })

  // PATCH /notifications/read-all  (must be before /:id/read to avoid route conflict)
  fastify.patch('/read-all', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    await prisma.notification.updateMany({
      where: { userId: payload.userId, read: false },
      data:  { read: true },
    })
    return reply.send({ ok: true })
  })

  // PATCH /notifications/:id/read
  fastify.patch<{ Params: { id: string } }>('/:id/read', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: payload.userId },
      data:  { read: true },
    })
    return reply.send({ ok: true })
  })
}
