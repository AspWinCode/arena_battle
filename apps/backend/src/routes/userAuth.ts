import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db/client.js'

const registerSchema = z.object({
  email:           z.string().email(),
  username:        z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Только латиница, цифры и _'),
  displayName:     z.string().min(1).max(30),
  password:        z.string().min(6).max(72),
  preferredLang:   z.enum(['js', 'py', 'cpp', 'java']).optional(),
  preferredSkin:   z.enum(['robot', 'gladiator', 'boxer', 'cosmonaut']).optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  programmingYears:z.number().int().min(0).max(40).optional(),
  avatar:          z.string().max(4).optional(),
})

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

const updateSchema = z.object({
  displayName:      z.string().min(1).max(30).optional(),
  bio:              z.string().max(500).optional(),
  avatar:           z.string().max(4).optional(),
  preferredLang:    z.enum(['js', 'py', 'cpp', 'java']).optional(),
  preferredSkin:    z.enum(['robot', 'gladiator', 'boxer', 'cosmonaut']).optional(),
  experienceLevel:  z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  programmingYears: z.number().int().min(0).max(40).optional(),
})

function signUserToken(fastify: Parameters<FastifyPluginAsync>[0], userId: string, email: string) {
  return fastify.jwt.sign({ userId, email, type: 'user' }, { expiresIn: '30d' })
}

export const userAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // Register
  fastify.post('/register', async (req, reply) => {
    const body = registerSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ error: body.error.issues[0]?.message ?? 'Invalid input', code: 'INVALID_INPUT' })
    }

    const { email, username, displayName, password, ...profile } = body.data

    const exists = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    })
    if (exists) {
      const field = exists.email === email ? 'Email' : 'Username'
      return reply.status(409).send({ error: `${field} уже занят`, code: 'CONFLICT' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, username, displayName, passwordHash, ...profile },
      select: { id: true, email: true, username: true, displayName: true, avatar: true, preferredLang: true, preferredSkin: true },
    })

    const token = signUserToken(fastify, user.id, user.email)
    return reply.status(201).send({ user, token })
  })

  // Login
  fastify.post('/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT' })

    const user = await prisma.user.findUnique({
      where: { email: body.data.email },
      select: { id: true, email: true, username: true, displayName: true, avatar: true, preferredLang: true, preferredSkin: true, passwordHash: true },
    })
    if (!user || !await bcrypt.compare(body.data.password, user.passwordHash)) {
      return reply.status(401).send({ error: 'Неверный email или пароль', code: 'INVALID_CREDENTIALS' })
    }

    const { passwordHash: _, ...safeUser } = user
    const token = signUserToken(fastify, user.id, user.email)
    return reply.send({ user: safeUser, token })
  })

  // Get own profile (requires user token)
  fastify.get('/me', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, username: true, displayName: true,
        avatar: true, bio: true, preferredLang: true, preferredSkin: true,
        experienceLevel: true, programmingYears: true, createdAt: true,
      },
    })
    if (!user) return reply.status(404).send({ error: 'Not found' })
    return reply.send(user)
  })

  // Update own profile
  fastify.patch('/me', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const body = updateSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' })

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: body.data,
      select: {
        id: true, email: true, username: true, displayName: true,
        avatar: true, bio: true, preferredLang: true, preferredSkin: true,
        experienceLevel: true, programmingYears: true,
      },
    })
    return reply.send(user)
  })

  // Change password
  fastify.post('/change-password', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return reply.status(400).send({ error: 'Пароль минимум 6 символов' })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user || !await bcrypt.compare(currentPassword, user.passwordHash)) {
      return reply.status(401).send({ error: 'Неверный текущий пароль' })
    }

    await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    })
    return reply.send({ ok: true })
  })
}
