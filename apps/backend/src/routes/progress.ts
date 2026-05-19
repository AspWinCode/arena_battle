import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import {
  ensureProgress,
  checkTopicUnlock,
  TOPIC_LIST,
  TOPIC_LABELS,
  TASKS_TO_UNLOCK,
  WINS_TO_UNLOCK,
  getContextVars,
  getAvailableActions,
} from '../services/division-service.js'
import type { GameTopic } from '@robocode/shared'

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

export const progressRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/progress — full player progress summary
  fastify.get('/', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const [user, progress] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { division: true, language: true, rating: true, totalWins: true, eloRating: true },
      }),
      ensureProgress(userId),
    ])

    if (!user) return reply.status(404).send({ error: 'Not found' })

    const unlockedTopics = progress.unlockedTopics as GameTopic[]
    const tasksDone = progress.topicTasksDone as Record<string, number>

    return reply.send({
      division: user.division,
      language: user.language,
      rating: user.rating,
      totalWins: user.totalWins,
      eloRating: user.eloRating,
      unlockedTopics,
      topicTasksDone: tasksDone,
      winsAfterLastTopic: progress.winsAfterLastTopic,
      availableActions: getAvailableActions(user.division as any, unlockedTopics.length),
      contextVars: getContextVars(unlockedTopics.length),
    })
  })

  // GET /api/v1/progress/topics — list of all 27 topics with progress
  fastify.get('/topics', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const [user, progress] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { language: true },
      }),
      ensureProgress(userId),
    ])

    if (!user) return reply.status(404).send({ error: 'Not found' })

    const unlockedSet = new Set(progress.unlockedTopics as GameTopic[])
    const tasksDone = progress.topicTasksDone as Record<string, number>
    const tasksSince = progress.topicBattlesSince as Record<string, number>

    const topics = TOPIC_LIST.map((id, index) => ({
      id,
      label: TOPIC_LABELS[id],
      level: index < 11 ? 1 : index < 18 ? 2 : 3,
      unlocked: unlockedSet.has(id),
      tasksDone: tasksDone[id] ?? 0,
      tasksRequired: TASKS_TO_UNLOCK,
      winsRequired: WINS_TO_UNLOCK,
      battlesSinceLastUse: tasksSince[id] ?? 0,
    }))

    return reply.send({ topics, language: user.language })
  })

  // POST /api/v1/progress/topics/:topicId/unlock — check conditions and unlock
  fastify.post<{ Params: { topicId: string } }>('/topics/:topicId/unlock', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const result = await checkTopicUnlock(userId)

    if (!result.unlocked) {
      const progress = await prisma.playerProgress.findUnique({
        where: { userId },
        select: { topicTasksDone: true, winsAfterLastTopic: true, unlockedTopics: true },
      })
      const tasksDone = (progress?.topicTasksDone as Record<string, number>) ?? {}
      const nextTopic = TOPIC_LIST.find((t) => !(progress?.unlockedTopics as GameTopic[]).includes(t))

      return reply.status(400).send({
        error: 'Conditions not met',
        code: 'NOT_READY',
        details: {
          tasksCompleted: nextTopic ? (tasksDone[nextTopic] ?? 0) : 0,
          tasksRequired: TASKS_TO_UNLOCK,
          winsCompleted: progress?.winsAfterLastTopic ?? 0,
          winsRequired: WINS_TO_UNLOCK,
        },
      })
    }

    return reply.send({
      ok: true,
      topic: result.topic,
      newContextVars: result.newContextVarsUnlocked,
    })
  })
}
