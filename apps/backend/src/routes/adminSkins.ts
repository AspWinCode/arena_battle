/**
 * Admin routes for skin management + file upload.
 * All routes require an admin JWT (Bearer token).
 *
 * POST   /admin/skins/upload            — upload one PNG, returns { url }
 * GET    /admin/skins                   — list all SkinDefs
 * GET    /admin/skins/character/:charId — SkinDefs for one character (or auto-create default)
 * POST   /admin/skins                   — create SkinDef
 * PATCH  /admin/skins/:id               — update SkinDef (name, price, inShop, images, …)
 * PATCH  /admin/skins/:id/action        — update one action's frames+fps inside actions JSON
 * DELETE /admin/skins/:id               — delete SkinDef
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'
import { prisma } from '../db/client.js'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/app/uploads'

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
}

function requireAdmin(fastify: Parameters<FastifyPluginAsync>[0]) {
  return async (req: any, reply: any) => {
    try {
      const payload = await req.jwtVerify() as { type?: string }
      if (payload.type === 'user') throw new Error('admin required')
    } catch {
      return reply.status(401).send({ error: 'Admin auth required' })
    }
  }
}

const createSchema = z.object({
  id:          z.string().min(2).max(60).regex(/^[a-z0-9_]+$/),
  characterId: z.string().min(1).max(40),
  name:        z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  rarity:      z.enum(['common', 'rare', 'epic', 'legendary']).default('common'),
  price:       z.number().int().min(0).default(0),
  inShop:      z.boolean().default(false),
  imgIdle:     z.string().max(500).default(''),
  imgAttack:   z.string().max(500).default(''),
  imgHit:      z.string().max(500).default(''),
  imgDeath:    z.string().max(500).default(''),
})

const updateSchema = z.object({
  name:        z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  rarity:      z.enum(['common', 'rare', 'epic', 'legendary']).optional(),
  price:       z.number().int().min(0).optional(),
  inShop:      z.boolean().optional(),
  imgIdle:     z.string().max(500).optional(),
  imgAttack:   z.string().max(500).optional(),
  imgHit:      z.string().max(500).optional(),
  imgDeath:    z.string().max(500).optional(),
  actions:     z.record(z.object({
    fps:    z.number().int().min(1).max(60),
    frames: z.array(z.string().max(500)).max(10),
  })).optional(),
})

const actionSchema = z.object({
  action: z.string().min(1).max(40),
  fps:    z.number().int().min(1).max(60).default(12),
  frames: z.array(z.string().max(500)).max(10),
})

export const adminSkinsRoutes: FastifyPluginAsync = async (fastify) => {

  // ── Upload a single PNG ──────────────────────────────────────────────────────
  fastify.post('/upload', {
    preHandler: requireAdmin(fastify),
  }, async (req, reply) => {
    const data = await (req as any).file()
    if (!data) return reply.status(400).send({ error: 'No file' })

    const ext = path.extname(data.filename).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
      return reply.status(400).send({ error: 'Только PNG/JPG/WEBP/GIF' })
    }

    await ensureUploadsDir()
    const filename = `${randomUUID()}${ext}`
    const filepath = path.join(UPLOADS_DIR, filename)
    const buffer   = await data.toBuffer()

    if (buffer.length > 5 * 1024 * 1024) {
      return reply.status(400).send({ error: 'Файл не должен превышать 5 МБ' })
    }

    await fs.writeFile(filepath, buffer)
    return reply.send({ url: `/api/v1/uploads/${filename}` })
  })

  // ── List all skins ──────────────────────────────────────────────────────────
  fastify.get('/', {
    preHandler: requireAdmin(fastify),
  }, async (_req, reply) => {
    const skins = await prisma.skinDef.findMany({
      orderBy: [{ characterId: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { owners: true } } },
    })
    return reply.send(skins)
  })

  // ── Get / auto-create default skin for a character ──────────────────────────
  // Returns all SkinDefs for this character. If none exist, creates <charId>_default.
  fastify.get('/character/:charId', {
    preHandler: requireAdmin(fastify),
  }, async (req, reply) => {
    const { charId } = req.params as { charId: string }

    let skins = await prisma.skinDef.findMany({
      where: { characterId: charId },
      orderBy: { createdAt: 'asc' },
    })

    if (skins.length === 0) {
      const defaultSkin = await prisma.skinDef.create({
        data: {
          id:          `${charId}_default`,
          characterId: charId,
          name:        `${charId} (default)`,
          rarity:      'common',
          price:       0,
          inShop:      false,
          actions:     {},
        },
      })
      skins = [defaultSkin]
    }

    return reply.send(skins)
  })

  // ── Create skin ─────────────────────────────────────────────────────────────
  fastify.post('/', {
    preHandler: requireAdmin(fastify),
  }, async (req, reply) => {
    const body = createSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ error: body.error.issues[0]?.message ?? 'Invalid input' })
    }

    const exists = await prisma.skinDef.findUnique({ where: { id: body.data.id } })
    if (exists) return reply.status(409).send({ error: 'Скин с таким id уже существует' })

    const skin = await prisma.skinDef.create({ data: body.data })
    return reply.status(201).send(skin)
  })

  // ── Update skin ─────────────────────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: requireAdmin(fastify),
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = updateSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ error: body.error.issues[0]?.message ?? 'Invalid input' })
    }

    const skin = await prisma.skinDef.update({
      where: { id },
      data:  body.data,
    }).catch(() => null)

    if (!skin) return reply.status(404).send({ error: 'Скин не найден' })
    return reply.send(skin)
  })

  // ── Update single action (frames + fps) ────────────────────────────────────
  // Merges into the existing actions JSON rather than replacing the whole object.
  fastify.patch('/:id/action', {
    preHandler: requireAdmin(fastify),
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = actionSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ error: body.error.issues[0]?.message ?? 'Invalid input' })
    }

    const existing = await prisma.skinDef.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Скин не найден' })

    const currentActions = (existing.actions as Record<string, unknown>) ?? {}
    const updated = {
      ...currentActions,
      [body.data.action]: { fps: body.data.fps, frames: body.data.frames },
    }

    const skin = await prisma.skinDef.update({
      where: { id },
      data:  { actions: updated },
    })
    return reply.send(skin)
  })

  // ── Delete skin ─────────────────────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: requireAdmin(fastify),
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    await prisma.userSkin.deleteMany({ where: { skinDefId: id } })
    await prisma.skinDef.delete({ where: { id } }).catch(() => null)

    return reply.send({ ok: true })
  })
}
