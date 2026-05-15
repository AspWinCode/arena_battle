import type { FastifyPluginAsync } from 'fastify'
import { SPARRING_BOTS, PERKS, mergeEffects } from '@robocode/shared'
import type { Lang } from '@robocode/shared'
import { runInSandbox } from '../sandbox/sandbox-service.js'
import { runMatch } from '../engine/battle-engine.js'

// ── Perk effect applied to player strategy ────────────────────────────────────

function buildPerkOverlay(perkIds: string[], streakRageBonus: number): Partial<import('@robocode/shared').Strategy> {
  const perks = PERKS.filter(p => perkIds.includes(p.id))
  const fx = perks.length > 0 ? mergeEffects(perks) : {}
  const totalRageBonus = (fx.bonusRage ?? 0) + streakRageBonus
  return {
    ...(fx.bonusHp    ? { bonusHp:     fx.bonusHp }    : {}),
    ...(fx.bonusStam  ? { bonusStam:   fx.bonusStam }  : {}),
    ...(fx.dmgMult    ? { dmgMult:     fx.dmgMult }    : {}),
    ...(fx.repairBonus ? { repairBonus: fx.repairBonus } : {}),
    ...(fx.shieldBonus ? { shieldBonus: fx.shieldBonus } : {}),
    ...(totalRageBonus > 0 ? { bonusRage: totalRageBonus } : {}),
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const sparringRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/sparring/run
  // Body: { code, lang, botId, format, perkIds?, streakRageBonus? }
  // Returns: { winner, score, rounds }
  app.post<{
    Body: {
      code:            string
      lang:            Lang
      botId:           string
      format:          'bo1' | 'bo3' | 'bo5'
      perkIds?:        string[]
      streakRageBonus?: number
      preferredSkin?:  string
    }
  }>('/run', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['code', 'lang', 'botId', 'format'],
        properties: {
          code:            { type: 'string', maxLength: 5000 },
          lang:            { type: 'string', enum: ['js', 'py', 'cpp', 'java'] },
          botId:           { type: 'string' },
          format:          { type: 'string', enum: ['bo1', 'bo3', 'bo5'] },
          perkIds:         { type: 'array', items: { type: 'string' }, maxItems: 2 },
          streakRageBonus: { type: 'number', minimum: 0, maximum: 100 },
          preferredSkin:   { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { code, lang, botId, format, perkIds = [], streakRageBonus = 0, preferredSkin } = req.body

    // Resolve bot
    const bot = SPARRING_BOTS.find(b => b.id === botId)
    if (!bot) return reply.status(400).send({ error: `Unknown bot: ${botId}` })

    // Compile player code in sandbox
    let playerStrategy: import('@robocode/shared').Strategy
    try {
      playerStrategy = await runInSandbox(code, lang)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(422).send({ error: `Ошибка компиляции: ${msg}` })
    }

    // Apply skin + perks + streak rage bonus
    const skin = (preferredSkin ?? 'robot') as import('@robocode/shared').SkinId
    const overlay = buildPerkOverlay(perkIds, streakRageBonus)
    playerStrategy = { ...playerStrategy, character: skin, ...overlay }

    // Run match
    try {
      const result = await runMatch(playerStrategy, bot.strategy, format)
      return reply.send(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(500).send({ error: `Ошибка выполнения: ${msg}` })
    }
  })
}
