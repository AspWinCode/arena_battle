import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import nodemailer from 'nodemailer'
import { ALL_SKIN_IDS } from '@robocode/shared'
import { ensureProgress } from '../services/division-service.js'

function makeResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendResetEmail(to: string, code: string) {
  const host = process.env.SMTP_HOST
  if (!host) return // email not configured — skip silently
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'no-reply@robocode.arena',
    to,
    subject: 'Восстановление пароля — CodeFighters',
    text: `Ваш код сброса пароля: ${code}\n\nКод действует 10 минут.`,
    html: `<h2>CodeFighters</h2><p>Ваш код сброса пароля:</p><h1 style="letter-spacing:8px;font-family:monospace">${code}</h1><p style="color:#888">Код действует 10 минут. Если вы не запрашивали сброс — проигнорируйте это письмо.</p>`,
  })
}

const registerSchema = z.object({
  email:           z.string().email(),
  username:        z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Только латиница, цифры и _'),
  displayName:     z.string().min(1).max(30),
  password:        z.string().min(6).max(72),
  language:        z.enum(['PYTHON', 'JAVASCRIPT', 'JAVA', 'CPP']).optional(),
  preferredLang:   z.enum(['js', 'py', 'cpp', 'java']).optional(),
  preferredSkin:   z.enum(ALL_SKIN_IDS).optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  programmingYears:z.number().int().min(0).max(40).optional(),
  avatar:          z.string().max(200000).optional(),
})

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

const updateSchema = z.object({
  displayName:      z.string().min(1).max(30).optional(),
  bio:              z.string().max(500).optional(),
  // avatar can be an emoji (1-4 chars) OR a data: URL (base64) OR a /uploads/ path
  avatar:           z.string().max(200000).optional(),
  language:         z.enum(['PYTHON', 'JAVASCRIPT', 'JAVA', 'CPP']).optional(),
  preferredLang:    z.enum(['js', 'py', 'cpp', 'java']).optional(),
  preferredSkin:    z.enum(ALL_SKIN_IDS).optional(),
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
      where: { OR: [{ email }, { username }, { displayName }] },
      select: { email: true, username: true, displayName: true },
    })
    if (exists) {
      const field = exists.email === email ? 'Email' : exists.username === username ? 'Username' : 'Имя на арене'
      return reply.status(409).send({ error: `${field} уже занят`, code: 'CONFLICT' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const { language, ...legacyProfile } = profile
    const user = await prisma.user.create({
      data: {
        email, username, displayName, passwordHash,
        ...legacyProfile,
        ...(language ? { language } : {}),
      },
      select: {
        id: true, email: true, username: true, displayName: true,
        avatar: true, preferredLang: true, preferredSkin: true,
        language: true, division: true,
      },
    })

    // Create initial PlayerProgress
    await ensureProgress(user.id)

    const token = signUserToken(fastify, user.id, user.email)
    return reply.status(201).send({ user, token })
  })

  // Check display name availability (no auth required)
  fastify.get('/check-display-name', async (req, reply) => {
    const { name } = req.query as { name?: string }
    if (!name || name.trim().length < 1) return reply.send({ available: false })
    const found = await prisma.user.findFirst({
      where: { displayName: { equals: name.trim(), mode: 'insensitive' } },
      select: { id: true },
    })
    return reply.send({ available: !found })
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

  // ── Forgot password ─────────────────────────────────────────────────────────
  fastify.post('/forgot-password', async (req, reply) => {
    const { email } = req.body as { email: string }
    if (!email) return reply.status(400).send({ error: 'Email обязателен' })

    const user = await prisma.user.findUnique({ where: { email } })
    // Always return 200 to avoid user enumeration, but only store token if user exists
    if (user) {
      const code = makeResetCode()
      const expiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: code, passwordResetExpiry: expiry },
      })
      await sendResetEmail(email, code).catch(err =>
        console.error('[reset] Email send failed:', err)
      )
      // In dev/no-smtp mode: return code in response so admin can relay it
      if (!process.env.SMTP_HOST) {
        return reply.send({ ok: true, devCode: code, note: 'SMTP не настроен — код возвращён напрямую' })
      }
    }
    return reply.send({ ok: true })
  })

  // ── Reset password with code ─────────────────────────────────────────────────
  fastify.post('/reset-password', async (req, reply) => {
    const { email, code, newPassword } = req.body as { email: string; code: string; newPassword: string }
    if (!email || !code || !newPassword) return reply.status(400).send({ error: 'Все поля обязательны' })
    if (newPassword.length < 6) return reply.status(400).send({ error: 'Пароль минимум 6 символов' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.passwordResetToken !== code) {
      return reply.status(400).send({ error: 'Неверный или устаревший код' })
    }
    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      return reply.status(400).send({ error: 'Код истёк. Запросите новый.' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null },
    })
    return reply.send({ ok: true })
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
