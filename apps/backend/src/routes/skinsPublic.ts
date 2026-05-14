/**
 * Public skins API — no auth required.
 * Used by CharacterView to resolve PNG frames for any character.
 *
 * GET /skins/character/:charId — first SkinDef for a character (rendering data only)
 */

import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'

// Fields needed for rendering — no price/shop metadata exposed
const RENDER_SELECT = {
  id:          true,
  characterId: true,
  imgIdle:     true,
  imgAttack:   true,
  imgHit:      true,
  imgDeath:    true,
  actions:     true,
} as const

export const skinsPublicRoutes: FastifyPluginAsync = async (fastify) => {

  // Returns the primary (first created) skin for a character.
  // CharacterView calls this to get animation frames for the default skin.
  fastify.get('/character/:charId', async (req, reply) => {
    const { charId } = req.params as { charId: string }

    const skin = await prisma.skinDef.findFirst({
      where:   { characterId: charId },
      orderBy: { createdAt: 'asc' },
      select:  RENDER_SELECT,
    })

    if (!skin) return reply.status(404).send({ error: 'No skin found' })
    return reply.send(skin)
  })

  // Returns all skins for a character — useful for AdminCharactersPage thumbnail fetch.
  fastify.get('/list', async (_req, reply) => {
    const skins = await prisma.skinDef.findMany({
      orderBy: [{ characterId: 'asc' }, { createdAt: 'asc' }],
      select:  RENDER_SELECT,
    })
    return reply.send(skins)
  })
}
