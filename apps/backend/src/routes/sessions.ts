import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { prisma } from '../db/client.js'
import type { JoinSessionResponse } from '@robocode/shared'

const createSessionSchema = z.object({
  name: z.string().min(1).max(50),
  level: z.enum(['BLOCKS', 'CODE', 'PRO']),
  lang: z.enum(['js', 'py', 'cpp', 'java', 'auto']).optional(),
  format: z.enum(['bo1', 'bo3', 'bo5']).default('bo3'),
  timeLimit: z.number().min(5).max(30).default(10),
  allowedSkins: z.array(z.enum(['robot', 'gladiator', 'boxer', 'cosmonaut'])).optional(),
})

const joinSchema = z.object({
  sessionCode: z.string().length(6),
  name: z.string().min(1).max(20),
  skin: z.enum(['robot', 'gladiator', 'boxer', 'cosmonaut']),
})

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // Create session (admin only)
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const body = createSessionSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT' })
    }

    const jwt = request.user as { adminId: string }
    let code1: string, code2: string

    // Ensure unique codes
    do { code1 = generateCode() } while (await prisma.session.findUnique({ where: { code1 } }))
    do { code2 = generateCode() } while (code2 === code1 || await prisma.session.findUnique({ where: { code2 } }))

    const session = await prisma.session.create({
      data: {
        adminId: jwt.adminId,
        name: body.data.name,
        level: body.data.level,
        lang: body.data.lang,
        format: body.data.format,
        timeLimit: body.data.timeLimit,
        allowedSkins: body.data.allowedSkins ?? ['robot', 'gladiator', 'boxer', 'cosmonaut'],
        code1,
        code2,
      },
    })

    return {
      id: session.id,
      code1: session.code1,
      code2: session.code2,
      name: session.name,
      level: session.level,
      format: session.format,
      timeLimit: session.timeLimit,
    }
  })

  // List sessions (admin only)
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const jwt = request.user as { adminId: string }
    const sessions = await prisma.session.findMany({
      where: { adminId: jwt.adminId },
      include: { players: true, battles: true },
      orderBy: { createdAt: 'desc' },
    })
    return sessions
  })

  // Get session details (admin only)
  fastify.get<{ Params: { id: string } }>('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const jwt = request.user as { adminId: string }
    const session = await prisma.session.findFirst({
      where: { id: request.params.id, adminId: jwt.adminId },
      include: { players: true, battles: true },
    })
    if (!session) return reply.status(404).send({ error: 'Session not found', code: 'NOT_FOUND' })
    return session
  })

  // Delete session (admin only)
  fastify.delete<{ Params: { id: string } }>('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const jwt = request.user as { adminId: string }
    const session = await prisma.session.findFirst({
      where: { id: request.params.id, adminId: jwt.adminId },
    })
    if (!session) return reply.status(404).send({ error: 'Session not found', code: 'NOT_FOUND' })
    await prisma.session.delete({ where: { id: request.params.id } })
    return { ok: true }
  })

  // Join session (public, rate limited)
  fastify.post<{ Body: unknown }>('/join', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = joinSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT' })
    }

    const { sessionCode, name, skin } = body.data

    // Find session by code1 or code2
    const session = await prisma.session.findFirst({
      where: {
        OR: [{ code1: sessionCode }, { code2: sessionCode }],
        status: { in: ['WAITING', 'CODING'] },
      },
      include: { players: true },
    })

    if (!session) {
      return reply.status(404).send({ error: 'Session not found or already started', code: 'SESSION_NOT_FOUND' })
    }

    // Check skin is allowed
    if (!session.allowedSkins.includes(skin)) {
      return reply.status(400).send({ error: 'Skin not allowed', code: 'SKIN_NOT_ALLOWED' })
    }

    // Determine player slot
    const slot = session.code1 === sessionCode ? 1 : 2

    // Check if slot is already taken
    const existingPlayer = session.players.find((p: { slot: number }) => p.slot === slot)
    if (existingPlayer) {
      return reply.status(409).send({ error: 'Slot already taken', code: 'SLOT_TAKEN' })
    }

    // Create player
    await prisma.player.create({
      data: {
        sessionId: session.id,
        slot,
        name,
        skin,
      },
    })

    // Generate WS token for this player
    const wsToken = fastify.jwt.sign(
      { sessionId: session.id, slot, name, skin },
      { expiresIn: '2h' }
    )

    const response: JoinSessionResponse = {
      sessionId: session.id,
      playerSlot: slot as 1 | 2,
      wsToken,
    }

    return response
  })
}
