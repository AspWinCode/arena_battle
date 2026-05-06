import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import {
  calcSkillScore,
  generateBracket,
  advanceWinner,
} from '../tournament/tournament-service.js'
import bcrypt from 'bcryptjs'
import {
  sendApprovalWithCredentials,
  sendApprovalNotification,
  sendRejectionNotification,
} from '../services/email.js'

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

    // Link to user account if logged in
    let userId: string | undefined
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type === 'user') userId = payload.userId
    } catch { /* not logged in — ok */ }

    const application = await prisma.tournamentApplication.create({
      data: { tournamentId: req.params.id, skillScore, ...body.data, ...(userId ? { userId } : {}) },
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

  // Review application (approve / reject) — auto-creates user account on approval
  fastify.patch<{ Params: { id: string; appId: string } }>(
    '/:id/applications/:appId',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const body = reviewSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Invalid input' })

      const app = await prisma.tournamentApplication.findUnique({
        where: { id: req.params.appId },
        include: { tournament: { select: { name: true } } },
      })
      if (!app) return reply.status(404).send({ error: 'Not found' })

      let userId = app.userId

      // On approval: create user account if doesn't exist
      if (body.data.status === 'APPROVED' && !userId) {
        const existing = await prisma.user.findUnique({ where: { email: app.playerEmail } })

        if (existing) {
          userId = existing.id
          await sendApprovalNotification({
            to: app.playerEmail,
            playerName: app.playerName,
            tournamentName: app.tournament.name,
          })
        } else {
          // Auto-generate username & password
          const baseUsername = app.playerName
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 20) || 'player'

          // Ensure unique username
          let username = baseUsername
          let suffix = 1
          while (await prisma.user.findUnique({ where: { username } })) {
            username = `${baseUsername}${suffix++}`
          }

          const password = Math.random().toString(36).slice(2, 10) +
                           Math.random().toString(36).slice(2, 6).toUpperCase()

          const newUser = await prisma.user.create({
            data: {
              email:           app.playerEmail,
              username,
              displayName:     app.playerName,
              passwordHash:    await bcrypt.hash(password, 10),
              preferredLang:   app.preferredLang,
              experienceLevel: app.experienceLevel,
              programmingYears: app.programmingYears,
            },
          })
          userId = newUser.id

          await sendApprovalWithCredentials({
            to:             app.playerEmail,
            playerName:     app.playerName,
            username,
            password,
            tournamentName: app.tournament.name,
          })
        }
      }

      // On rejection: send notification email
      if (body.data.status === 'REJECTED' && app.status !== 'REJECTED') {
        await sendRejectionNotification({
          to:             app.playerEmail,
          playerName:     app.playerName,
          tournamentName: app.tournament.name,
          reason:         body.data.adminNote,
        })
      }

      const updated = await prisma.tournamentApplication.update({
        where: { id: req.params.appId },
        data:  { ...body.data, ...(userId ? { userId } : {}) },
      })
      return reply.send(updated)
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

  // Get current user's match in a tournament (JWT user auth)
  fastify.get<{ Params: { id: string } }>(
    '/:id/my-match',
    async (req, reply) => {
      let userId: string
      try {
        const payload = await req.jwtVerify<{ userId: string; type: string }>()
        if (payload.type !== 'user') throw new Error()
        userId = payload.userId
      } catch {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      // Find approved application for this user in this tournament
      const app = await prisma.tournamentApplication.findFirst({
        where: { tournamentId: req.params.id, userId, status: 'APPROVED' },
      })
      if (!app) return reply.status(404).send({ error: 'No approved application' })

      // Find their current active (non-finished) match
      const match = await prisma.tournamentMatch.findFirst({
        where: {
          tournamentId: req.params.id,
          winnerId: null,
          OR: [{ p1Id: app.id }, { p2Id: app.id }],
        },
        orderBy: { round: 'asc' },
        include: {
          p1:      { select: { id: true, playerName: true, preferredLang: true } },
          p2:      { select: { id: true, playerName: true, preferredLang: true } },
          session: { select: { id: true, code1: true, code2: true } },
        },
      })

      if (!match) {
        // Check if they've won (all their matches have winners = them)
        const won = await prisma.tournamentMatch.findFirst({
          where: { tournamentId: req.params.id, winnerId: app.id },
          orderBy: { round: 'desc' },
        })
        return reply.send({ status: 'waiting', wonLastMatch: !!won })
      }

      const isP1     = match.p1Id === app.id
      const opponent = isP1 ? match.p2 : match.p1
      const myCode   = isP1 ? match.session?.code1 : match.session?.code2

      return reply.send({
        status:    'active',
        matchId:   match.id,
        round:     match.round,
        position:  match.position,
        isP1,
        opponent,
        sessionId: match.session?.id ?? null,
        joinCode:  myCode ?? null,
        hasSession: !!match.session,
      })
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
