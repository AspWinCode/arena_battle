// ── In-memory matchmaking queue ───────────────────────────────────────────────
// Stores players waiting for an opponent. When two compatible players are found
// a session is created automatically and both get session codes back.

import { prisma } from '../db/client.js'
import { ALL_SKIN_IDS } from '@robocode/shared'

interface QueueEntry {
  userId:   string
  name:     string
  skin:     string
  lang:     string
  elo:      number
  division: string
  joinedAt: Date
  // Set when matched
  matched?:  true
  sessionId?: string
  playerCode?: string
  opponentName?: string
  matchedAt?: Date
}

// userId → QueueEntry
const queue = new Map<string, QueueEntry>()

const ELO_RANGE_BASE    = 150   // initial acceptable ELO difference
const ELO_RANGE_PER_SEC = 5     // expand by this per second in queue

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function uniqueCode(field: 'code1' | 'code2'): Promise<string> {
  let code: string
  do {
    code = generateCode()
  } while (await prisma.session.findUnique({ where: { [field]: code } as { code1: string } | { code2: string } }))
  return code
}

/** Join the queue. Returns immediately; caller should poll getStatus. */
export async function joinQueue(userId: string, name: string, skin: string, lang: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { elo: true, division: true } })
  const elo = user?.elo ?? 1000
  const division = user?.division ?? 'DIVISION_2'

  queue.set(userId, { userId, name, skin, lang, elo, division, joinedAt: new Date() })

  // Attempt immediate match
  await tryMatch(userId)
}

/** Leave the queue. */
export function leaveQueue(userId: string): void {
  queue.delete(userId)
}

/** Get current queue status for a user. */
export function getQueueStatus(userId: string): {
  inQueue: boolean
  matched: boolean
  sessionId?: string
  playerCode?: string
  opponentName?: string
  waitSeconds?: number
  queueSize?: number
} {
  const entry = queue.get(userId)
  if (!entry) return { inQueue: false, matched: false }

  if (entry.matched) {
    return {
      inQueue: false,
      matched: true,
      sessionId:    entry.sessionId,
      playerCode:   entry.playerCode,
      opponentName: entry.opponentName,
    }
  }

  const waitSeconds = Math.floor((Date.now() - entry.joinedAt.getTime()) / 1000)
  // Re-attempt match on every status poll (handles new entrants)
  tryMatch(userId).catch(() => {})

  return {
    inQueue: true,
    matched: false,
    waitSeconds,
    queueSize: queue.size,
  }
}

/** Try to find a compatible opponent for the given userId. */
async function tryMatch(userId: string): Promise<void> {
  const me = queue.get(userId)
  if (!me || me.matched) return

  const waitSec    = (Date.now() - me.joinedAt.getTime()) / 1000
  const eloRange   = ELO_RANGE_BASE + Math.floor(waitSec * ELO_RANGE_PER_SEC)

  // Find best candidate: closest ELO within range, not self, not yet matched
  let bestCandidate: QueueEntry | null = null
  let bestDiff = Infinity

  for (const [otherId, other] of queue) {
    if (otherId === userId || other.matched) continue
    const diff = Math.abs(other.elo - me.elo)
    if (diff <= eloRange && diff < bestDiff) {
      bestDiff = diff
      bestCandidate = other
    }
  }

  if (!bestCandidate) return

  // Match found — create a session
  const candidate = bestCandidate

  let code1: string, code2: string
  try {
    code1 = await uniqueCode('code1')
    code2 = await uniqueCode('code2')

    const bothDiv2 = me.division === 'DIVISION_2' && candidate.division === 'DIVISION_2'
    const sessionLevel = bothDiv2 ? 'BLOCKS' : 'CODE'

    const session = await prisma.session.create({
      data: {
        adminId:     null,
        name:        `⚡ ${me.name} vs ${candidate.name}`,
        level:       sessionLevel,
        lang:        me.lang === 'auto' || candidate.lang === 'auto' ? null : (me.lang || null),
        format:      'bo3',
        timeLimit:   10,
        allowedSkins: [...ALL_SKIN_IDS],
        code1,
        code2,
      },
    })

    // Link players
    await Promise.all([
      prisma.player.create({ data: { sessionId: session.id, slot: 1, name: me.name,        skin: me.skin,        userId: me.userId        } }),
      prisma.player.create({ data: { sessionId: session.id, slot: 2, name: candidate.name, skin: candidate.skin, userId: candidate.userId } }),
    ])

    // Mark both entries as matched
    me.matched      = true
    me.sessionId    = session.id
    me.playerCode   = code1
    me.opponentName = candidate.name
    me.matchedAt    = new Date()

    candidate.matched      = true
    candidate.sessionId    = session.id
    candidate.playerCode   = code2
    candidate.opponentName = me.name
    candidate.matchedAt    = new Date()

  } catch (err) {
    console.error('[matchmaking] Failed to create session:', err)
  }
}
