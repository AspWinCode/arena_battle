import { prisma } from '../db/client.js'

// ── Skill score ────────────────────────────────────────────────────────────────
// Factors: declared experience, years coding, historical win rate in sessions

const EXP_POINTS: Record<string, number> = {
  beginner:     20,
  intermediate: 50,
  advanced:     90,
}

export async function calcSkillScore(
  playerName: string,
  experienceLevel: string,
  programmingYears: number,
): Promise<number> {
  // Count historical wins from Battle table (by player name in linked sessions)
  const wins = await prisma.battle.count({
    where: {
      session: {
        players: {
          some: { name: playerName, slot: { in: [1, 2] } },
        },
      },
      winner: {
        in: await prisma.player
          .findMany({ where: { name: playerName }, select: { slot: true } })
          .then(ps => [...new Set(ps.map(p => p.slot))]),
      },
    },
  })

  const expPts   = EXP_POINTS[experienceLevel] ?? 20
  const yearsPts = Math.min(programmingYears * 8, 80)   // cap at 80
  const winPts   = Math.min(wins * 4, 120)              // cap at 120

  return expPts + yearsPts + winPts
}

// ── Bracket generation ────────────────────────────────────────────────────────
// Single-elimination, power-of-2, standard seeding (1 vs N, 2 vs N-1 …)

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/**
 * Seeded bracket positions for N players (N must be power of 2).
 * Returns pairs [seed1, seed2] for each first-round match in correct bracket order.
 */
function seededBracket(n: number): Array<[number, number]> {
  // Start with [1, 2] and recursively interleave
  const order: number[] = [1]
  let size = 1
  while (size < n) {
    const next: number[] = []
    for (const s of order) {
      next.push(s)
      next.push(size * 2 + 2 - s)
    }
    order.splice(0, order.length, ...next)
    size *= 2
  }
  // Build pairs
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < order.length; i += 2) {
    pairs.push([order[i], order[i + 1]])
  }
  return pairs
}

export async function generateBracket(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    include: {
      applications: {
        where: { status: 'APPROVED' },
        orderBy: { skillScore: 'desc' },
      },
    },
  })

  const approved = tournament.applications
  if (approved.length < 2) {
    throw new Error('Нужно минимум 2 участника')
  }

  const slotCount = nextPow2(approved.length)
  const totalRounds = Math.log2(slotCount)

  // Assign seeds
  await Promise.all(
    approved.map((app, i) =>
      prisma.tournamentApplication.update({
        where: { id: app.id },
        data:  { seed: i + 1 },
      })
    )
  )

  // Build seed → application map (nulls = BYE)
  const byId: Record<number, string | null> = {}
  for (let s = 1; s <= slotCount; s++) {
    byId[s] = approved[s - 1]?.id ?? null
  }

  // Delete existing matches (re-generate)
  await prisma.tournamentMatch.deleteMany({ where: { tournamentId } })

  // Create round-1 matches
  const pairs = seededBracket(slotCount)
  const round1Matches = await Promise.all(
    pairs.map((pair, pos) => {
      const [s1, s2] = pair
      const p1 = byId[s1] ?? null
      const p2 = byId[s2] ?? null
      return prisma.tournamentMatch.create({
        data: {
          tournamentId,
          round:    1,
          position: pos + 1,
          p1Id:     p1,
          p2Id:     p2,
          // Auto-advance BYE matches
          status:   (!p1 || !p2) ? 'DONE' : 'SCHEDULED',
          winnerId: !p1 ? p2 : !p2 ? p1 : null,
        },
      })
    })
  )

  // Create placeholder matches for subsequent rounds
  let prevCount = round1Matches.length
  for (let r = 2; r <= totalRounds; r++) {
    prevCount = prevCount / 2
    await Promise.all(
      Array.from({ length: prevCount }, (_, i) =>
        prisma.tournamentMatch.create({
          data: {
            tournamentId,
            round:    r,
            position: i + 1,
            status:   'PENDING',
          },
        })
      )
    )
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data:  { bracketGeneratedAt: new Date(), status: 'ACTIVE' },
  })
}

// ── Advance winner ────────────────────────────────────────────────────────────
// Called after a match session finishes; advances winner to next match

export async function advanceWinner(matchId: string, winnerId: string): Promise<void> {
  const match = await prisma.tournamentMatch.findUniqueOrThrow({ where: { id: matchId } })

  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data:  { winnerId, status: 'DONE' },
  })

  const nextRound    = match.round + 1
  const nextPosition = Math.ceil(match.position / 2)

  const nextMatch = await prisma.tournamentMatch.findUnique({
    where: {
      tournamentId_round_position: {
        tournamentId: match.tournamentId,
        round:        nextRound,
        position:     nextPosition,
      },
    },
  })

  if (!nextMatch) {
    // Final match done → tournament complete
    await prisma.tournament.update({
      where: { id: match.tournamentId },
      data:  { status: 'DONE' },
    })
    return
  }

  // Fill p1 or p2 slot based on whether position is odd/even
  const isLeft = match.position % 2 === 1
  await prisma.tournamentMatch.update({
    where: { id: nextMatch.id },
    data:  {
      ...(isLeft ? { p1Id: winnerId } : { p2Id: winnerId }),
      status: nextMatch.p1Id || nextMatch.p2Id ? 'SCHEDULED' : 'PENDING',
    },
  })
}

// ── Auto-bracket cron check ───────────────────────────────────────────────────
// Call this from a cron every hour; generates bracket for tournaments
// that reach T-10 days and are still in CLOSED status

export async function checkAndGeneratePendingBrackets(): Promise<void> {
  const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)

  const due = await prisma.tournament.findMany({
    where: {
      status:    'CLOSED',
      startDate: { lte: tenDaysFromNow },
    },
  })

  for (const t of due) {
    try {
      await generateBracket(t.id)
      console.log(`[tournament] Generated bracket for "${t.name}" (${t.id})`)
    } catch (e) {
      console.error(`[tournament] Bracket generation failed for ${t.id}:`, e)
    }
  }
}
