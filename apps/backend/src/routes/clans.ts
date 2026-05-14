import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { createNotification } from '../services/notifications.js'

// ── Schemas ────────────────────────────────────────────────────────────────────

const createClanSchema = z.object({
  name:        z.string().min(2).max(40),
  tag:         z.string().min(2).max(5).regex(/^[A-Z0-9]+$/, 'Tag must be uppercase alphanumeric'),
  description: z.string().max(500).optional(),
  avatar:      z.string().max(10).optional(),
})

const updateClanSchema = z.object({
  description: z.string().max(500).optional(),
  avatar:      z.string().max(10).optional(),
})

const createWarSchema = z.object({
  targetClanId:   z.string().min(1),
  durationDays:   z.number().int().min(1).max(14).default(3),
})

// ── Helper ─────────────────────────────────────────────────────────────────────

async function requireClanRole(userId: string, clanId: string, minRole: 'MEMBER' | 'OFFICER' | 'OWNER') {
  const member = await prisma.clanMember.findFirst({ where: { clanId, userId } })
  if (!member) return null
  const roles = ['MEMBER', 'OFFICER', 'OWNER']
  if (roles.indexOf(member.role) < roles.indexOf(minRole)) return null
  return member
}

export const clanRoutes: FastifyPluginAsync = async (fastify) => {

  // ── List clans (public, sorted by ELO) ──────────────────────────────────────
  fastify.get('/', async (_req, reply) => {
    const clans = await prisma.clan.findMany({
      orderBy: { elo: 'desc' },
      include: {
        _count: { select: { members: true } },
        owner:  { select: { id: true, username: true, displayName: true, avatar: true } },
      },
    })
    return reply.send(clans)
  })

  // ── Get my clan (auth user) ──────────────────────────────────────────────────
  fastify.get('/me', async (req, reply) => {
    let userId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      userId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const member = await prisma.clanMember.findUnique({
      where: { userId },
      include: {
        clan: {
          include: {
            members: {
              include: { user: { select: { id: true, username: true, displayName: true, avatar: true, elo: true } } },
              orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
            },
            owner: { select: { id: true, username: true, displayName: true, avatar: true } },
            _count: { select: { members: true } },
          },
        },
      },
    })
    if (!member) return reply.send(null)
    return reply.send({ ...member.clan, myRole: member.role })
  })

  // ── Get single clan (public) ─────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    let userId: string | null = null
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type === 'user') userId = payload.userId
    } catch { /* unauthenticated — ok */ }

    const clan = await prisma.clan.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, displayName: true, avatar: true, elo: true } } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
        owner: { select: { id: true, username: true, displayName: true, avatar: true } },
        _count: { select: { members: true } },
      },
    })
    if (!clan) return reply.status(404).send({ error: 'Not found' })

    const myMember = userId ? clan.members.find(m => m.userId === userId) : null
    return reply.send({ ...clan, myRole: myMember?.role ?? null })
  })

  // ── Create clan (auth user) ──────────────────────────────────────────────────
  fastify.post('/', async (req, reply) => {
    let userId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      userId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const body = createClanSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.flatten() })

    // Check user is not already in a clan
    const existing = await prisma.clanMember.findUnique({ where: { userId } })
    if (existing) return reply.status(409).send({ error: 'Ты уже состоишь в клане' })

    // Check uniqueness
    const [nameTaken, tagTaken] = await Promise.all([
      prisma.clan.findUnique({ where: { name: body.data.name } }),
      prisma.clan.findUnique({ where: { tag: body.data.tag } }),
    ])
    if (nameTaken) return reply.status(409).send({ error: 'Имя клана занято' })
    if (tagTaken)  return reply.status(409).send({ error: 'Тег клана занят' })

    const clan = await prisma.clan.create({
      data: {
        name:        body.data.name,
        tag:         body.data.tag,
        description: body.data.description,
        avatar:      body.data.avatar ?? '⚔️',
        ownerId:     userId,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
    })

    return reply.status(201).send(clan)
  })

  // ── Update clan info (owner only) ────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    let userId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      userId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const clan = await prisma.clan.findUnique({ where: { id: req.params.id } })
    if (!clan) return reply.status(404).send({ error: 'Not found' })
    if (clan.ownerId !== userId) return reply.status(403).send({ error: 'Только владелец может редактировать клан' })

    const body = updateClanSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' })

    const updated = await prisma.clan.update({
      where: { id: req.params.id },
      data:  body.data,
    })
    return reply.send(updated)
  })

  // ── Delete clan (owner only) ─────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    let userId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      userId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const clan = await prisma.clan.findUnique({ where: { id: req.params.id } })
    if (!clan) return reply.status(404).send({ error: 'Not found' })
    if (clan.ownerId !== userId) return reply.status(403).send({ error: 'Только владелец может удалить клан' })

    await prisma.clanMessage.deleteMany({ where: { clanId: req.params.id } })
    await prisma.clanWar.deleteMany({
      where: { OR: [{ clan1Id: req.params.id }, { clan2Id: req.params.id }] },
    })
    await prisma.clanMember.deleteMany({ where: { clanId: req.params.id } })
    await prisma.clan.delete({ where: { id: req.params.id } })

    return reply.send({ ok: true })
  })

  // ── Join clan (auth user) ────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/join', async (req, reply) => {
    let userId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      userId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    // Check user is not already in a clan
    const existing = await prisma.clanMember.findUnique({ where: { userId } })
    if (existing) return reply.status(409).send({ error: 'Ты уже состоишь в клане' })

    const clan = await prisma.clan.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { members: true } } },
    })
    if (!clan) return reply.status(404).send({ error: 'Not found' })
    if (clan._count.members >= 20) return reply.status(400).send({ error: 'Клан заполнен (макс. 20 человек)' })

    const member = await prisma.clanMember.create({
      data: { clanId: req.params.id, userId, role: 'MEMBER' },
    })
    return reply.status(201).send(member)
  })

  // ── Leave clan (auth user) ───────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/leave', async (req, reply) => {
    let userId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      userId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const clan = await prisma.clan.findUnique({ where: { id: req.params.id } })
    if (!clan) return reply.status(404).send({ error: 'Not found' })
    if (clan.ownerId === userId) return reply.status(400).send({ error: 'Владелец не может покинуть клан — сначала передай владение или удали клан' })

    await prisma.clanMember.deleteMany({ where: { clanId: req.params.id, userId } })
    return reply.send({ ok: true })
  })

  // ── Kick member (owner or officer) ──────────────────────────────────────────
  fastify.delete<{ Params: { id: string; userId: string } }>('/:id/members/:userId', async (req, reply) => {
    let actorId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      actorId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const actor = await requireClanRole(actorId, req.params.id, 'OFFICER')
    if (!actor) return reply.status(403).send({ error: 'Недостаточно прав' })

    const target = await prisma.clanMember.findFirst({ where: { clanId: req.params.id, userId: req.params.userId } })
    if (!target) return reply.status(404).send({ error: 'Участник не найден' })

    // Officers can't kick other officers or the owner; only owner can kick officers
    const roles = ['MEMBER', 'OFFICER', 'OWNER']
    if (roles.indexOf(target.role) >= roles.indexOf(actor.role)) {
      return reply.status(403).send({ error: 'Нельзя исключить участника с равной или более высокой ролью' })
    }

    await prisma.clanMember.deleteMany({ where: { clanId: req.params.id, userId: req.params.userId } })
    return reply.send({ ok: true })
  })

  // ── Change member role (owner only) ─────────────────────────────────────────
  fastify.patch<{ Params: { id: string; userId: string }; Body: { role: string } }>(
    '/:id/members/:userId/role',
    async (req, reply) => {
      let actorId: string
      try {
        const payload = await req.jwtVerify<{ userId: string; type: string }>()
        if (payload.type !== 'user') throw new Error()
        actorId = payload.userId
      } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

      const clan = await prisma.clan.findUnique({ where: { id: req.params.id } })
      if (!clan) return reply.status(404).send({ error: 'Not found' })
      if (clan.ownerId !== actorId) return reply.status(403).send({ error: 'Только владелец может менять роли' })

      const { role } = req.body as { role?: string }
      if (!role || !['MEMBER', 'OFFICER'].includes(role)) {
        return reply.status(400).send({ error: 'role must be MEMBER or OFFICER' })
      }

      const updated = await prisma.clanMember.updateMany({
        where: { clanId: req.params.id, userId: req.params.userId },
        data:  { role },
      })
      if (updated.count === 0) return reply.status(404).send({ error: 'Участник не найден' })
      return reply.send({ ok: true })
    }
  )

  // ── Transfer ownership ───────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string }; Body: { newOwnerId: string } }>(
    '/:id/transfer',
    async (req, reply) => {
      let actorId: string
      try {
        const payload = await req.jwtVerify<{ userId: string; type: string }>()
        if (payload.type !== 'user') throw new Error()
        actorId = payload.userId
      } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

      const clan = await prisma.clan.findUnique({ where: { id: req.params.id } })
      if (!clan) return reply.status(404).send({ error: 'Not found' })
      if (clan.ownerId !== actorId) return reply.status(403).send({ error: 'Только владелец может передать клан' })

      const { newOwnerId } = req.body as { newOwnerId?: string }
      if (!newOwnerId) return reply.status(400).send({ error: 'newOwnerId required' })

      const targetMember = await prisma.clanMember.findFirst({ where: { clanId: req.params.id, userId: newOwnerId } })
      if (!targetMember) return reply.status(404).send({ error: 'Новый владелец не состоит в клане' })

      await Promise.all([
        prisma.clan.update({ where: { id: req.params.id }, data: { ownerId: newOwnerId } }),
        prisma.clanMember.updateMany({ where: { clanId: req.params.id, userId: newOwnerId }, data: { role: 'OWNER' } }),
        prisma.clanMember.updateMany({ where: { clanId: req.params.id, userId: actorId },   data: { role: 'MEMBER' } }),
      ])
      return reply.send({ ok: true })
    }
  )

  // ── Get chat messages (clan members only) ────────────────────────────────────
  fastify.get<{ Params: { id: string }; Querystring: { before?: string; limit?: string } }>(
    '/:id/messages',
    async (req, reply) => {
      let userId: string
      try {
        const payload = await req.jwtVerify<{ userId: string; type: string }>()
        if (payload.type !== 'user') throw new Error()
        userId = payload.userId
      } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

      const member = await prisma.clanMember.findFirst({ where: { clanId: req.params.id, userId } })
      if (!member) return reply.status(403).send({ error: 'Ты не состоишь в этом клане' })

      const { before, limit } = req.query as { before?: string; limit?: string }
      const take = Math.min(Number(limit) || 50, 100)

      const messages = await prisma.clanMessage.findMany({
        where:   { clanId: req.params.id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
        orderBy: { createdAt: 'desc' },
        take,
        include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
      })
      return reply.send(messages.reverse())
    }
  )

  // ── Send chat message (clan members only) ────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/messages', async (req, reply) => {
    let userId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      userId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const member = await prisma.clanMember.findFirst({ where: { clanId: req.params.id, userId } })
    if (!member) return reply.status(403).send({ error: 'Ты не состоишь в этом клане' })

    const { content } = req.body as { content?: string }
    if (!content || content.trim().length === 0) return reply.status(400).send({ error: 'content required' })
    if (content.trim().length > 1000) return reply.status(400).send({ error: 'Сообщение слишком длинное (макс. 1000 символов)' })

    const message = await prisma.clanMessage.create({
      data: { clanId: req.params.id, userId, content: content.trim() },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
    })
    return reply.status(201).send(message)
  })

  // ── Declare clan war (owner or officer) ──────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/wars', async (req, reply) => {
    let userId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      userId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const actor = await requireClanRole(userId, req.params.id, 'OFFICER')
    if (!actor) return reply.status(403).send({ error: 'Нужна роль офицера или выше' })

    const body = createWarSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' })

    if (body.data.targetClanId === req.params.id) {
      return reply.status(400).send({ error: 'Нельзя объявить войну самому себе' })
    }

    const targetClan = await prisma.clan.findUnique({ where: { id: body.data.targetClanId } })
    if (!targetClan) return reply.status(404).send({ error: 'Клан-противник не найден' })

    // Check no active war between these two clans
    const activeWar = await prisma.clanWar.findFirst({
      where: {
        status: { in: ['PENDING', 'ACTIVE'] },
        OR: [
          { clan1Id: req.params.id, clan2Id: body.data.targetClanId },
          { clan1Id: body.data.targetClanId, clan2Id: req.params.id },
        ],
      },
    })
    if (activeWar) return reply.status(409).send({ error: 'Уже есть активная война между кланами' })

    const startDate = new Date()
    const endDate   = new Date(Date.now() + body.data.durationDays * 24 * 60 * 60 * 1000)

    const war = await prisma.clanWar.create({
      data: {
        clan1Id:  req.params.id,
        clan2Id:  body.data.targetClanId,
        status:   'PENDING',
        startDate,
        endDate,
      },
    })

    // Notify target clan owner
    const [myClан, targetOwner] = await Promise.all([
      prisma.clan.findUnique({ where: { id: req.params.id }, select: { name: true, tag: true } }),
      prisma.clan.findUnique({ where: { id: body.data.targetClanId }, select: { ownerId: true, name: true } }),
    ])
    if (targetOwner) {
      await createNotification(targetOwner.ownerId, 'clan_war_started', {
        warId:       war.id,
        challengerClanId:   req.params.id,
        challengerClanName: myClан?.name,
        challengerClanTag:  myClан?.tag,
      })
    }

    return reply.status(201).send(war)
  })

  // ── Get war details (public) ─────────────────────────────────────────────────
  fastify.get<{ Params: { warId: string } }>('/wars/:warId', async (req, reply) => {
    const war = await prisma.clanWar.findUnique({
      where:   { id: req.params.warId },
      include: {
        clan1: { select: { id: true, name: true, tag: true, avatar: true, elo: true } },
        clan2: { select: { id: true, name: true, tag: true, avatar: true, elo: true } },
      },
    })
    if (!war) return reply.status(404).send({ error: 'Not found' })
    return reply.send(war)
  })

  // ── Accept war (target clan owner/officer) ───────────────────────────────────
  fastify.post<{ Params: { warId: string } }>('/wars/:warId/accept', async (req, reply) => {
    let userId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      userId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const war = await prisma.clanWar.findUnique({ where: { id: req.params.warId } })
    if (!war) return reply.status(404).send({ error: 'Not found' })
    if (war.status !== 'PENDING') return reply.status(400).send({ error: 'Война уже не ожидает принятия' })

    // Verify actor is officer+ of clan2
    const actor = await requireClanRole(userId, war.clan2Id, 'OFFICER')
    if (!actor) return reply.status(403).send({ error: 'Нужна роль офицера или выше в целевом клане' })

    const updated = await prisma.clanWar.update({
      where: { id: req.params.warId },
      data:  { status: 'ACTIVE' },
    })

    // Notify challenger clan owner
    const [clan2, clan1] = await Promise.all([
      prisma.clan.findUnique({ where: { id: war.clan2Id }, select: { name: true, tag: true } }),
      prisma.clan.findUnique({ where: { id: war.clan1Id }, select: { ownerId: true } }),
    ])
    if (clan1) {
      await createNotification(clan1.ownerId, 'clan_war_started', {
        warId:         war.id,
        acceptedByName: clan2?.name,
        acceptedByTag:  clan2?.tag,
        status:         'ACTIVE',
      })
    }

    return reply.send(updated)
  })

  // ── Decline war (target clan owner/officer) ──────────────────────────────────
  fastify.post<{ Params: { warId: string } }>('/wars/:warId/decline', async (req, reply) => {
    let userId: string
    try {
      const payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
      userId = payload.userId
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const war = await prisma.clanWar.findUnique({ where: { id: req.params.warId } })
    if (!war) return reply.status(404).send({ error: 'Not found' })
    if (war.status !== 'PENDING') return reply.status(400).send({ error: 'Война уже не ожидает принятия' })

    const actor = await requireClanRole(userId, war.clan2Id, 'OFFICER')
    if (!actor) return reply.status(403).send({ error: 'Нужна роль офицера или выше в целевом клане' })

    await prisma.clanWar.update({ where: { id: req.params.warId }, data: { status: 'DONE', winnerId: war.clan1Id } })
    return reply.send({ ok: true })
  })

  // ── List wars for a clan (public) ────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id/wars', async (req, reply) => {
    const wars = await prisma.clanWar.findMany({
      where: { OR: [{ clan1Id: req.params.id }, { clan2Id: req.params.id }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        clan1: { select: { id: true, name: true, tag: true, avatar: true } },
        clan2: { select: { id: true, name: true, tag: true, avatar: true } },
      },
    })

    // Auto-complete expired ACTIVE wars
    const now = new Date()
    await Promise.all(
      wars
        .filter(w => w.status === 'ACTIVE' && new Date(w.endDate) < now)
        .map(w => {
          const winnerId = w.clan1Score > w.clan2Score ? w.clan1Id
            : w.clan2Score > w.clan1Score ? w.clan2Id : null
          return prisma.clanWar.update({
            where: { id: w.id },
            data:  { status: 'DONE', winnerId },
          })
        })
    )

    // Re-fetch updated wars
    const fresh = await prisma.clanWar.findMany({
      where: { OR: [{ clan1Id: req.params.id }, { clan2Id: req.params.id }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        clan1: { select: { id: true, name: true, tag: true, avatar: true } },
        clan2: { select: { id: true, name: true, tag: true, avatar: true } },
      },
    })
    return reply.send(fresh)
  })
}
