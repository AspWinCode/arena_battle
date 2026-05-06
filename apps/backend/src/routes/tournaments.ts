import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import {
  calcSkillScore,
  generateBracket,
  advanceWinner,
} from '../tournament/tournament-service.js'

// ── Schemas ────────────────────────────────────────────────────────────────────

const createTournamentSchema = z.object({
  name:                 z.string().min(1).max(80),
  description:          z.string().max(2000).optional(),
  startDate:            z.string().datetime(),
  registrationDeadline: z.string().datetime(),
  maxParticipants:      z.number().int().min(4).max(64).default(16),
  format:               z.enum(['bo1', 'bo3', 'bo5']).default('bo3'),
  level:                z.enum(['BLOCKS', 'CODE', 'PRO']).default('CODE'),
})

const applySchema = z.object({
  playerName:       z.string().min(1).max(30),
  playerEmail:      z.string().email(),
  experienceLevel:  z.enum(['beginner', 'intermediate', 'advanced']),
  programmingYears: z.number().int().min(0).max(40).default(0),
  preferredLang:    z.enum(['js', 'py', 'cpp', 'java', 'auto']).default('js'),
  about:            z.string().max(500).optional(),
})

const reviewSchema = z.object({
  status:    z.enum(['APPROVED', 'REJECTED']),
  adminNote: z.string().max(500).optional(),
})

// ── Public routes ──────────────────────────────────────────────────────────────

export const tournamentRoutes: FastifyPluginAsync = async (fastify) => {

  // List tournaments (public)
  fastify.get('/', async (_req, reply) => {
    const tournaments = await prisma.tournament.findMany({
      where:   { status: { not: 'DRAFT' } },
      orderBy: { startDate: 'asc' },
      include: {
        _count: { select: { applications: { where: { status: 'APPROVED' } } } },
      },
    })
    return reply.send(tournaments)
  })

  // Get single tournament with bracket (public)
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const tournament = await prisma.tournament.findUnique({
      where:   { id: req.params.id },
      include: {
        applications: {
          where:   { status: 'APPROVED' },
          orderBy: { seed: 'asc' },
          select:  {
            id: true, playerName: true, preferredLang: true,
            seed: true, skillScore: true, experienceLevel: true,
          },
        },
        matches: {
          orderBy: [{ round: 'asc' }, { position: 'asc' }],
          include: {
            p1:     { select: { id: true, playerName: true, seed: true } },
            p2:     { select: { id: true, playerName: true, seed: true } },
            winner: { select: { id: true, playerName: true, seed: true } },
            session: { select: { id: true, code1: true, code2: true } },
          },
        },
      },
    })
    if (!tournament) return reply.status(404).send({ error: 'Not found' })
    return reply.send(tournament)
  })

  // Apply to tournament (public)
  fastify.post<{ Params: { id: string } }>('/:id/apply', async (req, reply) => {
    const body = applySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' })

    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } })
    if (!tournament) return reply.status(404).send({ error: 'Not found' })
    if (tournament.status !== 'REGISTRATION') {
      return reply.status(400).send({ error: 'Регистрация закрыта' })
    }
    if (new Date() > tournament.registrationDeadline) {
      return reply.status(400).send({ error: 'Срок регистрации истёк' })
    }

    const existing = await prisma.tournamentApplication.findUnique({
      where: { tournamentId_playerEmail: { tournamentId: req.params.id, playerEmail: body.data.playerEmail } },
    })
    if (existing) return reply.status(409).send({ error: 'Эта почта уже подала заявку' })

    const approved = await prisma.tournamentApplication.count({
      where: { tournamentId: req.params.id, status: 'APPROVED' },
    })
    if (approved >= tournament.maxParticipants) {
      return reply.status(400).send({ error: 'Мест больше нет' })
    }

    const skillScore = await calcSkillScore(
      body.data.playerName,
      body.data.experienceLevel,
      body.data.programmingYears,
    )

    const application = await prisma.tournamentApplication.create({
      data: { tournamentId: req.params.id, skillScore, ...body.data },
    })

    return reply.status(201).send({
      id: application.id,
      status: application.status,
      message: 'Заявка принята. Ожидайте решения организатора.',
    })
  })

  // Check application status by email (public)
  fastify.get<{ Params: { id: string }; Querystring: { email: string } }>(
    '/:id/application',
    async (req, reply) => {
      const { email } = req.query as { email?: string }
      if (!email) return reply.status(400).send({ error: 'email required' })

      const app = await prisma.tournamentApplication.findUnique({
        where: { tournamentId_playerEmail: { tournamentId: req.params.id, playerEmail: email } },
        select: { id: true, status: true, adminNote: true, seed: true, createdAt: true },
      })
      if (!app) return reply.status(404).send({ error: 'Заявка не найдена' })
      return reply.send(app)
    }
  )

  // ── Admin routes ─────────────────────────────────────────────────────────────

  // Create tournament
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const body = createTournamentSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() })

    const tournament = await prisma.tournament.create({ data: body.data })
    return reply.status(201).send(tournament)
  })

  // Update tournament (status transitions, dates, etc.)
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const body = createTournamentSchema.partial().safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Invalid input' })

      const tournament = await prisma.tournament.update({
        where: { id: req.params.id },
        data:  body.data,
      })
      return reply.send(tournament)
    }
  )

  // Open / close registration
  fastify.post<{ Params: { id: string }; Body: { status: string } }>(
    '/:id/status',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const { status } = req.body as { status: string }
      const allowed = ['DRAFT', 'REGISTRATION', 'CLOSED', 'ACTIVE', 'DONE']
      if (!allowed.includes(status)) return reply.status(400).send({ error: 'Invalid status' })

      const tournament = await prisma.tournament.update({
        where: { id: req.params.id },
        data:  { status: status as never },
      })
      return reply.send(tournament)
    }
  )

  // List all applications for a tournament (admin)
  fastify.get<{ Params: { id: string } }>(
    '/:id/applications',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const apps = await prisma.tournamentApplication.findMany({
        where:   { tournamentId: req.params.id },
        orderBy: { createdAt: 'asc' },
      })
      return reply.send(apps)
    }
  )

  // Review application (approve / reject)
  fastify.patch<{ Params: { id: string; appId: string } }>(
    '/:id/applications/:appId',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const body = reviewSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Invalid input' })

      const app = await prisma.tournamentApplication.update({
        where: { id: req.params.appId },
        data:  body.data,
      })
      return reply.send(app)
    }
  )

  // Generate bracket manually (admin)
  fastify.post<{ Params: { id: string } }>(
    '/:id/generate-bracket',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      try {
        await generateBracket(req.params.id)
        const tournament = await prisma.tournament.findUnique({
          where: { id: req.params.id },
          include: {
            matches: {
              orderBy: [{ round: 'asc' }, { position: 'asc' }],
              include: {
                p1:     { select: { id: true, playerName: true, seed: true } },
                p2:     { select: { id: true, playerName: true, seed: true } },
                winner: { select: { id: true, playerName: true } },
              },
            },
          },
        })
        return reply.send(tournament)
      } catch (e) {
        return reply.status(400).send({ error: e instanceof Error ? e.message : 'Ошибка генерации' })
      }
    }
  )

  // Create a real battle session for a tournament match (admin)
  fastify.post<{ Params: { id: string; matchId: string } }>(
    '/:id/matches/:matchId/session',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const jwt = req.user as { adminId: string }

      const match = await prisma.tournamentMatch.findUnique({
        where: { id: req.params.matchId },
        include: { tournament: true },
      })
      if (!match) return reply.status(404).send({ error: 'Match not found' })
      if (match.sessionId) return reply.status(409).send({ error: 'Session already exists' })

      // Generate unique 6-char join codes
      function genCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      }
      let code1: string, code2: string
      do { code1 = genCode() } while (await prisma.session.findUnique({ where: { code1 } }))
      do { code2 = genCode() } while (code2 === code1 || await prisma.session.findUnique({ where: { code2 } }))

      const session = await prisma.session.create({
        data: {
          adminId: jwt.adminId,
          name: `${match.tournament.name} — Раунд ${match.round} #${match.position}`,
          level: match.tournament.level as 'BLOCKS' | 'CODE' | 'PRO',
          format: match.tournament.format as 'bo1' | 'bo3' | 'bo5',
          timeLimit: 10,
          allowedSkins: ['robot', 'gladiator', 'boxer', 'cosmonaut'],
          code1,
          code2,
        },
      })

      await prisma.tournamentMatch.update({
        where: { id: req.params.matchId },
        data:  { sessionId: session.id },
      })

      return reply.status(201).send({
        sessionId: session.id,
        code1: session.code1,
        code2: session.code2,
      })
    }
  )

  // Record match result (admin marks winner after session completes)
  fastify.post<{ Params: { id: string; matchId: string } }>(
    '/:id/matches/:matchId/result',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const { winnerId } = req.body as { winnerId: string }
      if (!winnerId) return reply.status(400).send({ error: 'winnerId required' })

      await advanceWinner(req.params.matchId, winnerId)
      return reply.send({ ok: true })
    }
  )

  // Delete tournament (admin)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      await prisma.tournamentMatch.deleteMany({ where: { tournamentId: req.params.id } })
      await prisma.tournamentApplication.deleteMany({ where: { tournamentId: req.params.id } })
      await prisma.tournament.delete({ where: { id: req.params.id } })
      return reply.send({ ok: true })
    }
  )
}
