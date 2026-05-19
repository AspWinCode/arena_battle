import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import { TOPIC_LABELS, TOPIC_LIST } from '../services/division-service.js'
import type { GameTopic, Language } from '@robocode/shared'

async function requireUser(req: any, reply: any): Promise<string | null> {
  try {
    const payload = (await req.jwtVerify()) as { userId: string; type: string }
    if (payload.type !== 'user') throw new Error()
    return payload.userId
  } catch {
    reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    return null
  }
}

// Code examples by topic and language
const CODE_EXAMPLES: Partial<Record<GameTopic, Partial<Record<Language, string>>>> = {
  INDEXING: {
    PYTHON: "if enemy_history and enemy_history[-1] == 'dodge':\n    action = 'laser'",
    JAVASCRIPT: "if (enemyHistory.length && enemyHistory[enemyHistory.length-1] === 'dodge') action = 'laser'",
  },
  FOR_LOOP: {
    PYTHON: "moves = ['attack', 'dodge', 'attack', 'laser']\naction = moves[round % len(moves)]",
    JAVASCRIPT: "const moves = ['attack','dodge','attack','laser']\naction = moves[round % moves.length]",
  },
  IF_ELSE_ELIF: {
    PYTHON: "if hp < 30:\n    action = 'repair'\nelif enemy_hp < 20:\n    action = 'combo'\nelse:\n    action = 'attack'",
    JAVASCRIPT: "if (hp < 30) action = 'repair'\nelse if (enemyHp < 20) action = 'combo'\nelse action = 'attack'",
  },
  ARRAYS_1D: {
    PYTHON: "moves = ['attack', 'combo', 'dodge']\naction = moves[round % 3]",
    JAVASCRIPT: "const moves = ['attack','combo','dodge']\naction = moves[round % 3]",
  },
  DICTS: {
    PYTHON: "plan = {1: 'laser', 2: 'combo', 3: 'trap'}\naction = plan.get(round, 'attack')",
    JAVASCRIPT: "const plan = {1: 'laser', 2: 'combo', 3: 'trap'}\naction = plan[round] || 'attack'",
  },
  NESTED_LOOPS: {
    PYTHON: "if len(enemy_history) >= 3:\n    last3 = enemy_history[-3:]\n    if last3.count('dodge') >= 2:\n        action = 'laser'",
  },
}

function getCodeExample(topic: GameTopic, language: Language): string {
  const examples = CODE_EXAMPLES[topic]
  if (!examples) return `# Попробуй применить тему «${TOPIC_LABELS[topic]}» в своей стратегии`
  return examples[language] ?? examples['PYTHON'] ?? `# Пример для ${topic}`
}

function getCta(topic: GameTopic): string {
  return `Открыть тему «${TOPIC_LABELS[topic]}» →`
}

// Messages for different triggers
function getAfterLossMessage(topic: GameTopic): string {
  const messages: Partial<Record<GameTopic, string>> = {
    INDEXING: 'Противник читал историю твоих ходов через enemy_history[-1]',
    FOR_LOOP: 'Попробуй зациклить паттерн ходов — это сделает стратегию непредсказуемой',
    IF_ELSE_ELIF: 'Добавь условия по HP — атакуй когда враг слаб, защищайся когда ты слаб',
    ARRAYS_1D: 'Сохрани паттерн ходов в список и переключайся по нему каждый раунд',
    DICTS: 'Спланируй ходы заранее с помощью словаря round → action',
    NESTED_LOOPS: 'Анализируй последние 3 хода врага — определи паттерн и контратакуй',
  }
  return messages[topic] ?? `Изучи тему «${TOPIC_LABELS[topic]}» — она поможет улучшить стратегию`
}

function getAfterWinMessage(topic: GameTopic): string {
  return `Игроки топ-50 используют «${TOPIC_LABELS[topic]}» в своих стратегиях — попробуй тоже`
}

// Generate recommendations for a player
export async function generateRecommendations(userId: string): Promise<Array<{
  id: string
  trigger: 'after_loss' | 'after_win' | 'topic_unused'
  topic: GameTopic
  message: string
  codeExample: string
  cta: string
}>> {
  const [user, progress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    }),
    prisma.playerProgress.findUnique({
      where: { userId },
      select: { unlockedTopics: true, topicBattlesSince: true },
    }),
  ])

  if (!user || !progress) return []

  const language = user.language as Language
  const unlockedTopics = (progress.unlockedTopics ?? []) as GameTopic[]
  const battlesSince = (progress.topicBattlesSince ?? {}) as Record<string, number>

  const recs: Array<{
    id: string
    trigger: 'after_loss' | 'after_win' | 'topic_unused'
    topic: GameTopic
    message: string
    codeExample: string
    cta: string
  }> = []

  // Topics unused for 10+ battles
  for (const topic of unlockedTopics) {
    const since = battlesSince[topic] ?? 0
    if (since >= 10) {
      recs.push({
        id: `unused_${topic}`,
        trigger: 'topic_unused',
        topic,
        message: `Ты не использовал тему «${TOPIC_LABELS[topic]}» уже ${since} боёв`,
        codeExample: getCodeExample(topic, language),
        cta: getCta(topic),
      })
    }
  }

  // Suggest the next unlockable topic if not too many recs
  if (recs.length < 2) {
    const nextTopic = TOPIC_LIST.find((t) => !unlockedTopics.includes(t))
    if (nextTopic) {
      recs.push({
        id: `next_topic_${nextTopic}`,
        trigger: 'after_win',
        topic: nextTopic,
        message: getAfterWinMessage(nextTopic),
        codeExample: getCodeExample(nextTopic, language),
        cta: getCta(nextTopic),
      })
    }
  }

  return recs.slice(0, 3)
}

export const recommendationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/recommendations
  fastify.get('/', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return

    const recs = await generateRecommendations(userId)
    return reply.send({ recommendations: recs })
  })

  // POST /api/v1/recommendations/:id/dismiss — mark as dismissed (stored in session, no DB)
  fastify.post<{ Params: { id: string } }>('/:id/dismiss', async (req, reply) => {
    const userId = await requireUser(req, reply)
    if (!userId) return
    // Recommendations are ephemeral — just acknowledge
    return reply.send({ ok: true })
  })
}
