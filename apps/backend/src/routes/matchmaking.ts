import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ALL_SKIN_IDS } from '@robocode/shared'
import { joinQueue, leaveQueue, getQueueStatus } from '../services/matchmaking.js'

const joinSchema = z.object({
  name: z.string().min(1).max(20),
  skin: z.enum(ALL_SKIN_IDS),
  lang: z.enum(['js', 'py', 'cpp', 'java', 'auto']).default('auto'),
})

export const matchmakingRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Join queue ────────────────────────────────────────────────────────────
  fastify.post('/queue', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const body = joinSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' })

    await joinQueue(payload.userId, body.data.name, body.data.skin, body.data.lang)
    return reply.send({ ok: true })
  })

  // ── Leave queue ───────────────────────────────────────────────────────────
  fastify.delete('/queue', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    leaveQueue(payload.userId)
    return reply.send({ ok: true })
  })

  // ── Poll queue status ─────────────────────────────────────────────────────
  fastify.get('/queue/status', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const status = getQueueStatus(payload.userId)
    return reply.send(status)
  })
}
