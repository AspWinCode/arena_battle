import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'

export const resultRoutes: FastifyPluginAsync = async (fastify) => {
  // Get battle result
  fastify.get<{ Params: { id: string } }>(
    '/:id/result',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const jwt = request.user as { adminId: string }
      const session = await prisma.session.findFirst({
        where: { id: request.params.id, adminId: jwt.adminId },
        include: { battles: true, players: true },
      })
      if (!session) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' })

      const wins = [0, 0]
      for (const battle of session.battles) {
        if (battle.winner === 1) wins[0]++
        else if (battle.winner === 2) wins[1]++
      }

      return {
        sessionId: session.id,
        status: session.status,
        winner: wins[0] > wins[1] ? 1 : wins[1] > wins[0] ? 2 : 0,
        score: wins,
        rounds: session.battles,
        players: session.players,
      }
    }
  )

  // Export CSV
  fastify.get<{ Params: { id: string } }>(
    '/:id/export',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const jwt = request.user as { adminId: string }
      const session = await prisma.session.findFirst({
        where: { id: request.params.id, adminId: jwt.adminId },
        include: { battles: true, players: true },
      })
      if (!session) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' })

      const wins = [0, 0]
      for (const battle of session.battles) {
        if (battle.winner === 1) wins[0]++
        else if (battle.winner === 2) wins[1]++
      }
      const winner = wins[0] > wins[1] ? 1 : wins[1] > wins[0] ? 2 : 0

      const p1 = session.players.find((p: { slot: number }) => p.slot === 1)
      const p2 = session.players.find((p: { slot: number }) => p.slot === 2)

      const csv = [
        'session_id,session_name,player1_name,player1_lang,player1_skin,player2_name,player2_lang,player2_skin,winner,score',
        [
          session.id,
          session.name,
          p1?.name ?? '',
          p1?.lang ?? '',
          p1?.skin ?? '',
          p2?.name ?? '',
          p2?.lang ?? '',
          p2?.skin ?? '',
          winner,
          `${wins[0]}-${wins[1]}`,
        ].join(','),
      ].join('\n')

      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', `attachment; filename="battle-${session.id}.csv"`)
      return csv
    }
  )
}
