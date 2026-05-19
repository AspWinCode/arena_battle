import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { runTaskCode } from '../sandbox/task-runner.js'
import { checkTopicUnlock, ensureProgress, TASKS_TO_UNLOCK } from '../services/division-service.js'
import type { GameTopic, Language } from '@robocode/shared'

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

const submitSchema = z.object({
  code: z.string().min(1).max(10000),
})

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/tasks?topic=FOR_LOOP — list tasks for a topic (user's language)
  fastify.get('/', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const { topic } = req.query as { topic?: string }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    })
    if (!user) return reply.status(404).send({ error: 'Not found' })

    const where: any = { language: user.language }
    if (topic) where.topic = topic

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ topic: 'asc' }, { orderIndex: 'asc' }],
      select: {
        id: true,
        topic: true,
        language: true,
        title: true,
        description: true,
        hint: true,
        difficulty: true,
        orderIndex: true,
      },
    })

    // Attach completion status for this user
    const completedIds = await prisma.taskCompletion.findMany({
      where: {
        userId,
        taskId: { in: tasks.map((t) => t.id) },
      },
      select: { taskId: true },
    })
    const completedSet = new Set(completedIds.map((c) => c.taskId))

    const withStatus = tasks.map((t) => ({ ...t, completed: completedSet.has(t.id) }))

    return reply.send({ tasks: withStatus })
  })

  // GET /api/v1/tasks/:taskId — single task with test cases (for solving)
  fastify.get<{ Params: { taskId: string } }>('/:taskId', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
    })
    if (!task) return reply.status(404).send({ error: 'Task not found' })

    const completion = await prisma.taskCompletion.findUnique({
      where: { taskId_userId: { taskId: task.id, userId } },
    })

    return reply.send({ ...task, completed: !!completion })
  })

  // POST /api/v1/tasks/:taskId/submit — submit task solution
  fastify.post<{ Params: { taskId: string } }>('/:taskId/submit', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const body = submitSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT' })
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
    })
    if (!task) return reply.status(404).send({ error: 'Task not found' })

    // Run against test cases
    const testCases = task.testCases as Array<{ input: string | null; expected_output: string }>
    const runResult = await runTaskCode(body.data.code, task.language as Language, testCases)

    if (runResult.passed) {
      // Record completion (idempotent)
      await prisma.taskCompletion.upsert({
        where: { taskId_userId: { taskId: task.id, userId } },
        create: { taskId: task.id, userId },
        update: {},
      })

      // Update topicTasksDone counter in PlayerProgress
      const progress = await ensureProgress(userId)
      const tasksDone = progress.topicTasksDone as Record<string, number>
      const topicKey = task.topic as string
      const prevCount = tasksDone[topicKey] ?? 0

      if (prevCount < TASKS_TO_UNLOCK) {
        await prisma.playerProgress.update({
          where: { userId },
          data: {
            topicTasksDone: { ...tasksDone, [topicKey]: prevCount + 1 },
          },
        })
      }

      // Check if topic can now be unlocked
      const unlockResult = await checkTopicUnlock(userId)

      return reply.send({
        passed: true,
        results: runResult.results,
        topicUnlocked: unlockResult.unlocked ? unlockResult.topic : null,
        newContextVars: unlockResult.newContextVarsUnlocked,
      })
    }

    return reply.send({
      passed: false,
      results: runResult.results,
      error: runResult.error,
    })
  })

  // GET /api/v1/tasks/completions — my completed tasks
  fastify.get('/completions', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const completions = await prisma.taskCompletion.findMany({
      where: { userId },
      select: { taskId: true, solvedAt: true, task: { select: { topic: true, title: true } } },
      orderBy: { solvedAt: 'desc' },
    })

    return reply.send({ completions })
  })
}
