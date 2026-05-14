/**
 * Shop & inventory routes (user-facing).
 *
 * GET  /shop                  — list skins where inShop=true (+ owned flag for auth users)
 * POST /shop/buy/:skinId      — purchase a skin (requires user JWT)
 * GET  /shop/inventory        — my owned skins (requires user JWT)
 * POST /shop/equip/:skinId    — equip skin for a character (requires user JWT)
 */

import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'

async function getUserId(req: any): Promise<string | null> {
  try {
    const payload = await req.jwtVerify() as { userId: string; type: string }
    if (payload.type !== 'user') return null
    return payload.userId
  } catch {
    return null
  }
}

export const shopRoutes: FastifyPluginAsync = async (fastify) => {

  // ── Public shop listing ─────────────────────────────────────────────────────
  fastify.get('/', async (req, reply) => {
    const userId = await getUserId(req)

    const skins = await prisma.skinDef.findMany({
      where: { inShop: true },
      orderBy: [{ characterId: 'asc' }, { price: 'asc' }],
    })

    type SkinRow = typeof skins[0]
    if (!userId) return reply.send(skins.map((s: SkinRow) => ({ ...s, owned: false, equippedFor: null })))

    const owned = await prisma.userSkin.findMany({
      where: { userId },
      select: { skinDefId: true, equippedFor: true },
    })
    const ownedIds   = new Set(owned.map((o: { skinDefId: string }) => o.skinDefId))
    const equippedMap: Record<string, string> = {}
    owned.forEach((o: { skinDefId: string; equippedFor: string | null }) => {
      if (o.equippedFor) equippedMap[o.skinDefId] = o.equippedFor
    })

    return reply.send(skins.map((s: SkinRow) => ({
      ...s,
      owned:       ownedIds.has(s.id),
      equippedFor: equippedMap[s.id] ?? null,
    })))
  })

  // ── Buy skin ────────────────────────────────────────────────────────────────
  fastify.post('/buy/:skinId', async (req, reply) => {
    const userId = await getUserId(req)
    if (!userId) return reply.status(401).send({ error: 'Требуется авторизация' })

    const { skinId } = req.params as { skinId: string }

    const skin = await prisma.skinDef.findUnique({ where: { id: skinId } })
    if (!skin) return reply.status(404).send({ error: 'Скин не найден' })
    if (!skin.inShop) return reply.status(400).send({ error: 'Скин недоступен в магазине' })

    const alreadyOwned = await prisma.userSkin.findUnique({
      where: { userId_skinDefId: { userId, skinDefId: skinId } },
    })
    if (alreadyOwned) return reply.status(409).send({ error: 'Скин уже куплен' })

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { coins: true } })
    if (!user) return reply.status(404).send({ error: 'Пользователь не найден' })

    if (user.coins < skin.price) {
      return reply.status(400).send({ error: `Недостаточно монет. Нужно: ${skin.price}, есть: ${user.coins}` })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data:  { coins: { decrement: skin.price } },
      }),
      prisma.userSkin.create({
        data: { userId, skinDefId: skinId },
      }),
    ])

    const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { coins: true } })
    return reply.send({ ok: true, coinsLeft: updatedUser?.coins ?? 0 })
  })

  // ── My inventory ────────────────────────────────────────────────────────────
  fastify.get('/inventory', async (req, reply) => {
    const userId = await getUserId(req)
    if (!userId) return reply.status(401).send({ error: 'Требуется авторизация' })

    const owned = await prisma.userSkin.findMany({
      where: { userId },
      include: { skinDef: true },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send(owned.map((o: { skinDef: object; equippedFor: string | null }) => ({
      ...o.skinDef,
      equippedFor: o.equippedFor,
    })))
  })

  // ── Equip skin ──────────────────────────────────────────────────────────────
  fastify.post('/equip/:skinId', async (req, reply) => {
    const userId = await getUserId(req)
    if (!userId) return reply.status(401).send({ error: 'Требуется авторизация' })

    const { skinId } = req.params as { skinId: string }
    const { characterId } = req.body as { characterId?: string }

    const owned = await prisma.userSkin.findUnique({
      where: { userId_skinDefId: { userId, skinDefId: skinId } },
      include: { skinDef: true },
    })
    if (!owned) return reply.status(403).send({ error: 'Скин не куплен' })

    const charId = characterId ?? owned.skinDef.characterId

    // Unequip any other skin currently equipped for this character
    await prisma.userSkin.updateMany({
      where: { userId, equippedFor: charId },
      data:  { equippedFor: null },
    })

    // Equip the requested skin
    await prisma.userSkin.update({
      where: { userId_skinDefId: { userId, skinDefId: skinId } },
      data:  { equippedFor: charId },
    })

    return reply.send({ ok: true, equippedFor: charId })
  })
}
