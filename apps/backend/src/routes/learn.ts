import type { FastifyInstance } from 'fastify'
import { MISSIONS } from '@robocode/shared'
import type { Lang } from '@robocode/shared'
import { runInSandbox } from '../sandbox/sandbox-service.js'
import { runMatch } from '../engine/battle-engine.js'
import { checkTopicUnlock } from '../services/division-service.js'
import { prisma } from '../db/client.js'

export async function learnRoutes(fastify: FastifyInstance) {
  fastify.post('/run', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['code', 'lang', 'missionId'],
        properties: {
          code:      { type: 'string', maxLength: 10000 },
          lang:      { type: 'string', enum: ['py', 'cpp', 'java'] },
          missionId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { code, lang, missionId } = request.body as {
      code: string; lang: Lang; missionId: string
    }

    const mission = MISSIONS.find(m => m.id === missionId)
    if (!mission) {
      return reply.code(404).send({ error: 'Mission not found' })
    }

    try {
      const playerStrategy = await runInSandbox(code, lang)
      const result = await runMatch(playerStrategy, mission.opponentStrategy, 'bo1')

      // Track win toward topic unlock (best-effort, don't block response)
      if (result.winner === 1) {
        try {
          const payload = await (request as any).jwtVerify() as { userId: string; type: string }
          if (payload?.userId) {
            const uid = payload.userId
            prisma.playerProgress.updateMany({
              where: { userId: uid },
              data: { winsAfterLastTopic: { increment: 1 } },
            }).then(() => checkTopicUnlock(uid)).catch(() => {/* silent */})
          }
        } catch {/* no auth — skip */}
      }

      return reply.send(result)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sandbox error'
      return reply.code(400).send({ error: message })
    }
  })
}
