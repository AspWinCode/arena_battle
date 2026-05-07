import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'

export const eloHistoryRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /elo-history/:userId — last 30 ELO changes (public)
  fastify.get<{ Params: { userId: string } }>('/:userId', async (req, reply) => {
    const history = await prisma.eloHistory.findMany({
      where:   { userId: req.params.userId },
      orderBy: { createdAt: 'asc' },
      take:    30,
    })

    // Enrich with opponent names
    const opponentIds = history.map(h => h.opponentId).filter(Boolean) as string[]
    const opponents = opponentIds.length > 0
      ? await prisma.user.findMany({
          where:  { id: { in: opponentIds } },
          select: { id: true, username: true, displayName: true, avatar: true },
        })
      : []
    const oppMap = Object.fromEntries(opponents.map(o => [o.id, o]))

    return reply.send(history.map(h => ({
      ...h,
      opponent: h.opponentId ? oppMap[h.opponentId] ?? null : null,
    })))
  })

  // GET /elo-history/~me — own history (requires auth)
  fastify.get('/~me', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const history = await prisma.eloHistory.findMany({
      where:   { userId: payload.userId },
      orderBy: { createdAt: 'asc' },
      take:    50,
    })

    const opponentIds = history.map(h => h.opponentId).filter(Boolean) as string[]
    const opponents = opponentIds.length > 0
      ? await prisma.user.findMany({
          where:  { id: { in: opponentIds } },
          select: { id: true, username: true, displayName: true, avatar: true },
        })
      : []
    const oppMap = Object.fromEntries(opponents.map(o => [o.id, o]))

    return reply.send(history.map(h => ({
      ...h,
      opponent: h.opponentId ? oppMap[h.opponentId] ?? null : null,
    })))
  })
}
