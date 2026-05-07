import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ALL_SKIN_IDS } from '@robocode/shared'
import { prisma } from '../db/client.js'
import { createNotification } from '../services/notifications.js'

const sendSchema = z.object({
  toUserId:   z.string().min(1).optional(),
  toUsername: z.string().min(1).optional(),
  skin:       z.enum(ALL_SKIN_IDS).optional(),
  lang:       z.enum(['js', 'py', 'cpp', 'java', 'auto']).optional(),
  message:    z.string().max(200).optional(),
})

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function uniqueCode(field: 'code1' | 'code2'): Promise<string> {
  let code: string
  do { code = generateCode() }
  while (await prisma.session.findUnique({ where: { [field]: code } as any }))
  return code
}

export const challengeRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Send challenge ────────────────────────────────────────────────────────
  fastify.post('/send', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const body = sendSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' })

    if (!body.data.toUserId && !body.data.toUsername) {
      return reply.status(400).send({ error: 'Укажи toUserId или toUsername' })
    }

    const toUser = await prisma.user.findUnique({
      where: body.data.toUserId
        ? { id: body.data.toUserId }
        : { username: body.data.toUsername! },
      select: { id: true, username: true, displayName: true },
    })
    if (!toUser) return reply.status(404).send({ error: 'Игрок не найден' })
    if (toUser.id === payload.userId) return reply.status(400).send({ error: 'Нельзя вызвать себя' })

    // Only one pending challenge between two users at a time
    const existing = await prisma.challenge.findFirst({
      where: {
        fromUserId: payload.userId,
        toUserId:   toUser.id,
        status:     'PENDING',
        expiresAt:  { gt: new Date() },
      },
    })
    if (existing) return reply.status(409).send({ error: 'Вызов уже отправлен', challengeId: existing.id })

    const fromUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { username: true, displayName: true, avatar: true, elo: true },
    })

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    const challenge = await prisma.challenge.create({
      data: {
        fromUserId: payload.userId,
        toUserId:   toUser.id,
        skin:       body.data.skin ?? 'robot',
        lang:       body.data.lang ?? 'auto',
        message:    body.data.message,
        expiresAt,
      },
    })

    await createNotification(toUser.id, 'challenge_received', {
      challengeId:       challenge.id,
      fromUserId:        payload.userId,
      fromUsername:      fromUser?.username,
      fromDisplayName:   fromUser?.displayName,
      fromAvatar:        fromUser?.avatar,
      fromElo:           fromUser?.elo,
      message:           body.data.message,
    })

    return reply.status(201).send({ id: challenge.id, challengeId: challenge.id })
  })

  // ── Get challenge status (sender polls this) ──────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id/status', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.id },
      include: {
        fromUser: { select: { id: true, username: true, displayName: true, avatar: true, elo: true } },
        toUser:   { select: { id: true, username: true, displayName: true, avatar: true, elo: true } },
      },
    })
    if (!challenge) return reply.status(404).send({ error: 'Not found' })
    if (challenge.fromUserId !== payload.userId && challenge.toUserId !== payload.userId) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    // Auto-expire
    if (challenge.status === 'PENDING' && challenge.expiresAt < new Date()) {
      await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'EXPIRED' } })
      return reply.send({ ...challenge, status: 'EXPIRED' })
    }

    // When accepted, include caller's player code so they can join
    let playerCode: string | null = null
    if (challenge.status === 'ACCEPTED' && challenge.sessionId) {
      const session = await prisma.session.findUnique({
        where:  { id: challenge.sessionId },
        select: { code1: true, code2: true },
      })
      if (session) {
        playerCode = payload.userId === challenge.fromUserId ? session.code1 : session.code2
      }
    }

    return reply.send({ ...challenge, playerCode })
  })

  // ── Accept challenge ──────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/accept', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const challenge = await prisma.challenge.findUnique({ where: { id: req.params.id } })
    if (!challenge) return reply.status(404).send({ error: 'Not found' })
    if (challenge.toUserId !== payload.userId) return reply.status(403).send({ error: 'Forbidden' })
    if (challenge.status !== 'PENDING') return reply.status(400).send({ error: 'Вызов уже не активен' })
    if (challenge.expiresAt < new Date()) {
      await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'EXPIRED' } })
      return reply.status(400).send({ error: 'Вызов истёк' })
    }

    // Get both users
    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: challenge.fromUserId }, select: { username: true, displayName: true, elo: true } }),
      prisma.user.findUnique({ where: { id: challenge.toUserId  }, select: { username: true, displayName: true, elo: true } }),
    ])

    // Create session
    const code1 = await uniqueCode('code1')
    const code2 = await uniqueCode('code2')

    const session = await prisma.session.create({
      data: {
        adminId:      null,
        name:         `⚔️ ${fromUser?.displayName} vs ${toUser?.displayName}`,
        level:        'CODE',
        lang:         challenge.lang === 'auto' ? null : challenge.lang,
        format:       'bo3',
        timeLimit:    10,
        allowedSkins: ['robot','gladiator','boxer','cosmonaut','ninja','mage','paladin','sniper','tank','vampire','samurai','phantom','engineer','berserker'],
        code1,
        code2,
      },
    })

    // Link players
    await Promise.all([
      prisma.player.create({ data: { sessionId: session.id, slot: 1, name: fromUser?.displayName ?? 'P1', skin: challenge.skin, userId: challenge.fromUserId } }),
      prisma.player.create({ data: { sessionId: session.id, slot: 2, name: toUser?.displayName   ?? 'P2', skin: challenge.skin, userId: challenge.toUserId   } }),
    ])

    // Update challenge
    await prisma.challenge.update({
      where: { id: challenge.id },
      data: { status: 'ACCEPTED', sessionId: session.id },
    })

    // Notify sender
    await createNotification(challenge.fromUserId, 'challenge_accepted', {
      challengeId:     challenge.id,
      sessionId:       session.id,
      playerCode:      code1,
      opponentName:    toUser?.displayName,
    })

    return reply.send({
      ok:         true,
      sessionId:  session.id,
      playerCode: code2,  // toUser gets code2
    })
  })

  // ── Decline challenge ─────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/decline', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const challenge = await prisma.challenge.findUnique({ where: { id: req.params.id } })
    if (!challenge) return reply.status(404).send({ error: 'Not found' })
    if (challenge.toUserId !== payload.userId) return reply.status(403).send({ error: 'Forbidden' })
    if (challenge.status !== 'PENDING') return reply.status(400).send({ error: 'Вызов уже не активен' })

    await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'DECLINED' } })

    const toUser = await prisma.user.findUnique({ where: { id: payload.userId }, select: { displayName: true } })
    await createNotification(challenge.fromUserId, 'challenge_declined', {
      challengeId:  challenge.id,
      opponentName: toUser?.displayName,
    })

    return reply.send({ ok: true })
  })

  // ── My pending incoming challenges ───────────────────────────────────────
  fastify.get('/incoming', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch { return reply.status(401).send({ error: 'Unauthorized' }) }

    const challenges = await prisma.challenge.findMany({
      where: {
        toUserId:  payload.userId,
        status:    'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: { select: { username: true, displayName: true, avatar: true, elo: true } },
      },
    })
    return reply.send(challenges)
  })
}
