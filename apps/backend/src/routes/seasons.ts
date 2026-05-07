import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { seasonDecay } from '../services/elo.js'
import { createNotification } from '../services/notifications.js'

const createSeasonSchema = z.object({
  name:      z.string().min(1).max(50),
  number:    z.number().int().positive(),
  startDate: z.string().datetime(),
  endDate:   z.string().datetime(),
})

export const seasonRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Public ────────────────────────────────────────────────────────────────

  // GET /seasons/current — active season info
  fastify.get('/current', async (_req, reply) => {
    const season = await prisma.season.findFirst({ where: { isActive: true } })
    return reply.send(season ?? null)
  })

  // GET /seasons — all seasons list
  fastify.get('/', async (_req, reply) => {
    const seasons = await prisma.season.findMany({ orderBy: { number: 'desc' } })
    return reply.send(seasons)
  })

  // GET /seasons/:id/leaderboard — top 30 for a season
  fastify.get<{ Params: { id: string } }>('/:id/leaderboard', async (req, reply) => {
    const ranks = await prisma.seasonRank.findMany({
      where:   { seasonId: req.params.id },
      orderBy: { rank: 'asc' },
      take:    30,
      include: {
        user: { select: { username: true, displayName: true, avatar: true, elo: true } },
      },
    })
    return reply.send(ranks)
  })

  // ── Admin-only (requires admin JWT) ──────────────────────────────────────

  async function adminAuth(req: any, reply: any) {
    try {
      const p = await req.jwtVerify() as { adminId: string }
      if (!p.adminId) throw new Error()
      return p.adminId
    } catch {
      reply.status(401).send({ error: 'Admin auth required' })
      return null
    }
  }

  // POST /seasons — create new season
  fastify.post('/', async (req, reply) => {
    const adminId = await adminAuth(req, reply)
    if (!adminId) return

    const body = createSeasonSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' })

    const season = await prisma.season.create({
      data: {
        name:      body.data.name,
        number:    body.data.number,
        startDate: new Date(body.data.startDate),
        endDate:   new Date(body.data.endDate),
        isActive:  false,
      },
    })
    return reply.status(201).send(season)
  })

  // POST /seasons/:id/activate — start this season (deactivates others)
  fastify.post<{ Params: { id: string } }>('/:id/activate', async (req, reply) => {
    const adminId = await adminAuth(req, reply)
    if (!adminId) return

    await prisma.season.updateMany({ data: { isActive: false } })
    const season = await prisma.season.update({
      where: { id: req.params.id },
      data:  { isActive: true },
    })
    return reply.send(season)
  })

  // POST /seasons/:id/end — snapshot rankings + apply ELO decay
  fastify.post<{ Params: { id: string } }>('/:id/end', async (req, reply) => {
    const adminId = await adminAuth(req, reply)
    if (!adminId) return

    const season = await prisma.season.findUnique({ where: { id: req.params.id } })
    if (!season) return reply.status(404).send({ error: 'Season not found' })
    if (!season.isActive) return reply.status(400).send({ error: 'Season is not active' })

    // Build ranking from current ELO
    const users = await prisma.user.findMany({
      where:   { totalBattles: { gt: 0 } },
      orderBy: [{ elo: 'desc' }, { totalWins: 'desc' }],
      select:  { id: true, elo: true },
    })

    // Snapshot + decay in parallel
    await prisma.$transaction([
      // Create SeasonRank records
      ...users.map((u, i) =>
        prisma.seasonRank.upsert({
          where:  { seasonId_userId: { seasonId: season.id, userId: u.id } },
          update: { elo: u.elo, rank: i + 1 },
          create: { seasonId: season.id, userId: u.id, elo: u.elo, rank: i + 1 },
        })
      ),
      // Deactivate season
      prisma.season.update({
        where: { id: season.id },
        data:  { isActive: false },
      }),
    ])

    // Apply ELO decay for all users (outside transaction — OK for large sets)
    for (const u of users) {
      const newElo = seasonDecay(u.elo)
      await prisma.user.update({
        where: { id: u.id },
        data:  { elo: newElo },
      })
      // Notify each player
      await createNotification(u.id, 'season_end', {
        seasonName: season.name,
        seasonNumber: season.number,
        finalElo: u.elo,
        newElo,
      }).catch(() => {})
    }

    return reply.send({ ok: true, snapshotted: users.length })
  })
}
