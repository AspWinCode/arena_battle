import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db/client.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT' })
    }

    const admin = await prisma.admin.findUnique({ where: { email: body.data.email } })
    if (!admin) {
      return reply.status(401).send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' })
    }

    const valid = await bcrypt.compare(body.data.password, admin.password)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' })
    }

    const accessToken = fastify.jwt.sign(
      { adminId: admin.id, email: admin.email },
      { expiresIn: '15m' }
    )
    const refreshToken = fastify.jwt.sign(
      { adminId: admin.id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    })

    return { accessToken }
  })

  fastify.post('/refresh', async (request, reply) => {
    const token = request.cookies.refreshToken
    if (!token) {
      return reply.status(401).send({ error: 'No refresh token', code: 'NO_REFRESH_TOKEN' })
    }

    try {
      const payload = fastify.jwt.verify<{ adminId: string; type: string }>(token)
      if (payload.type !== 'refresh') throw new Error()

      const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } })
      if (!admin) throw new Error()

      const accessToken = fastify.jwt.sign(
        { adminId: admin.id, email: admin.email },
        { expiresIn: '15m' }
      )
      return { accessToken }
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' })
    }
  })

  fastify.post('/logout', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    reply.clearCookie('refreshToken', { path: '/api/v1/auth' })
    return { ok: true }
  })

  // Dev-only: seed admin
  if (process.env.NODE_ENV !== 'production') {
    fastify.post('/seed-admin', async (request, reply) => {
      const body = loginSchema.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: 'Invalid input', code: 'INVALID_INPUT' })

      const exists = await prisma.admin.findUnique({ where: { email: body.data.email } })
      if (exists) return { ok: true, message: 'Admin already exists' }

      const hash = await bcrypt.hash(body.data.password, 12)
      await prisma.admin.create({ data: { email: body.data.email, password: hash } })
      return { ok: true }
    })
  }
}
