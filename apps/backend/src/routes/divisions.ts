import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import {
  checkDivisionPromotion,
  DIVISION_THRESHOLDS,
  getAvailableActions,
  getContextVars,
} from '../services/division-service.js'
import type { Division } from '@robocode/shared'

async function requireUser(req: any, reply: any): Promise<string | null> {
  try {
    const payload = (await req.jwtVerify()) as { userId: string; type: string }
    if (payload.type !== 'user') throw new Error()
    return payload.userId
  } catch {
    reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    return null
  }
}

function getDivisionProgress(division: Division, rating: number, totalWins: number, topicsCount: number) {
  if (division === 'DIVISION_2') {
    const t = DIVISION_THRESHOLDS.DIVISION_2
    return {
      ratingProgress: Math.min(rating, t.ratingToExit),
      ratingThreshold: t.ratingToExit,
      winsProgress: Math.min(totalWins, t.winsToExit),
      winsThreshold: t.winsToExit,
      topicsProgress: null,
      topicsThreshold: null,
      percentComplete: Math.min(
        100,
        Math.round(((rating / t.ratingToExit) * 0.5 + (totalWins / t.winsToExit) * 0.5) * 100),
      ),
    }
  }
  if (division === 'DIVISION_1') {
    const t = DIVISION_THRESHOLDS.DIVISION_1
    return {
      ratingProgress: Math.min(rating, t.ratingToExit),
      ratingThreshold: t.ratingToExit,
      winsProgress: Math.min(totalWins, t.winsToExit),
      winsThreshold: t.winsToExit,
      topicsProgress: Math.min(topicsCount, t.topicsToExit),
      topicsThreshold: t.topicsToExit,
      percentComplete: Math.min(
        100,
        Math.round(
          ((rating / t.ratingToExit) * 0.4 +
            (totalWins / t.winsToExit) * 0.4 +
            (topicsCount / t.topicsToExit) * 0.2) *
            100,
        ),
      ),
    }
  }
  // PREMIER_LEAGUE — no exit
  return null
}

export const divisionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/divisions/me — current division + progress to next
  fastify.get('/me', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        division: true,
        language: true,
        rating: true,
        totalWins: true,
        eloRating: true,
        progress: { select: { unlockedTopics: true } },
      },
    })
    if (!user) return reply.status(404).send({ error: 'Not found' })

    const topicsCount = user.progress?.unlockedTopics?.length ?? 0
    const divProgress = getDivisionProgress(
      user.division as Division,
      user.rating,
      user.totalWins,
      topicsCount,
    )
    const availableActions = getAvailableActions(user.division as Division, topicsCount)
    const contextVars = getContextVars(topicsCount)

    return reply.send({
      division: user.division,
      language: user.language,
      rating: user.rating,
      totalWins: user.totalWins,
      eloRating: user.eloRating,
      topicsUnlocked: topicsCount,
      progressToNext: divProgress,
      availableActions,
      contextVars,
    })
  })

  // POST /api/v1/divisions/check-promotion — check if player should be promoted
  fastify.post('/check-promotion', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const result = await checkDivisionPromotion(userId)
    return reply.send(result)
  })

  // GET /api/v1/divisions/rating — division leaderboard
  fastify.get('/rating', async (req, reply) => {
    const { division, limit = '50', offset = '0' } = req.query as {
      division?: string
      limit?: string
      offset?: string
    }

    const where = division ? { division: division as Division } : {}

    const [players, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { rating: 'desc' },
        take: Math.min(Number(limit), 100),
        skip: Number(offset),
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          division: true,
          rating: true,
          totalWins: true,
        },
      }),
      prisma.user.count({ where }),
    ])

    return reply.send({ players, total })
  })

  // GET /api/v1/divisions/rating/me — my position in the leaderboard
  fastify.get('/rating/me', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { division: true, rating: true },
    })
    if (!user) return reply.status(404).send({ error: 'Not found' })

    const position = await prisma.user.count({
      where: { division: user.division, rating: { gt: user.rating } },
    })

    return reply.send({
      position: position + 1,
      division: user.division,
      rating: user.rating,
    })
  })
}
