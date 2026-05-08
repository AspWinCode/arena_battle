import { prisma } from '../db/client.js'

// ── Skill score ─────────────────────────────────────────────────────────────

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
  const wins = await prisma.battle.count({
    where: {
      session: {
        players: { some: { name: playerName, slot: { in: [1, 2] } } },
      },
      winner: {
        in: await prisma.player
          .findMany({ where: { name: playerName }, select: { slot: true } })
          .then(ps => [...new Set(ps.map(p => p.slot))]),
      },
    },
  })
  const expPts   = EXP_POINTS[experienceLevel] ?? 20
  const yearsPts = Math.min(programmingYears * 8, 80)
  const winPts   = Math.min(wins * 4, 120)
  return expPts + yearsPts + winPts
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

function seededBracket(n: number): Array<[number, number]> {
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
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]])
  return pairs
}

// ── Single Elimination ────────────────────────────────────────────────────────

async function generateSingleElimBracket(tournamentId: string, approved: any[]): Promise<void> {
  const slotCount   = nextPow2(approved.length)
  const totalRounds = Math.log2(slotCount)

  await Promise.all(
    approved.map((app, i) =>
      prisma.tournamentApplication.update({ where: { id: app.id }, data: { seed: i + 1 } })
    )
  )

  const byId: Record<number, string | null> = {}
  for (let s = 1; s <= slotCount; s++) byId[s] = approved[s - 1]?.id ?? null

  await prisma.tournamentMatch.deleteMany({ where: { tournamentId } })

  const pairs = seededBracket(slotCount)
  const round1 = await Promise.all(
    pairs.map((pair, pos) => {
      const [s1, s2] = pair
      const p1 = byId[s1] ?? null
      const p2 = byId[s2] ?? null
      return prisma.tournamentMatch.create({
        data: {
          tournamentId, round: 1, position: pos + 1, bracket: 'W',
          p1Id: p1, p2Id: p2,
          status:   (!p1 || !p2) ? 'DONE' : 'SCHEDULED',
          winnerId: !p1 ? p2 : !p2 ? p1 : null,
        },
      })
    })
  )

  let prevCount = round1.length
  for (let r = 2; r <= totalRounds; r++) {
    prevCount = Math.ceil(prevCount / 2)
    await Promise.all(
      Array.from({ length: prevCount }, (_, i) =>
        prisma.tournamentMatch.create({
          data: { tournamentId, round: r, position: i + 1, bracket: 'W', status: 'PENDING' },
        })
      )
    )
  }
}

// ── Round Robin ───────────────────────────────────────────────────────────────
// Circle method: N players → N-1 rounds, N/2 matches per round

async function generateRoundRobinBracket(tournamentId: string, approved: any[]): Promise<void> {
  await Promise.all(
    approved.map((app, i) =>
      prisma.tournamentApplication.update({ where: { id: app.id }, data: { seed: i + 1 } })
    )
  )

  let players = approved.map((a, i) => ({ id: a.id, seed: i + 1 }))
  if (players.length % 2 !== 0) players.push({ id: 'BYE', seed: 0 })

  const n      = players.length
  const rounds = n - 1

  await prisma.tournamentMatch.deleteMany({ where: { tournamentId } })

  const rotate = (arr: typeof players) => [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]
  let current = [...players]

  for (let r = 1; r <= rounds; r++) {
    let pos = 1
    for (let i = 0; i < n / 2; i++) {
      const p1 = current[i]
      const p2 = current[n - 1 - i]
      if (p1.id === 'BYE' || p2.id === 'BYE') continue
      await prisma.tournamentMatch.create({
        data: { tournamentId, round: r, position: pos++, bracket: 'W', p1Id: p1.id, p2Id: p2.id, status: 'SCHEDULED' },
      })
    }
    current = rotate(current)
  }
}

// ── Double Elimination ────────────────────────────────────────────────────────

async function generateDoubleElimBracket(tournamentId: string, approved: any[]): Promise<void> {
  const slotCount = nextPow2(approved.length)
  const wbRounds  = Math.log2(slotCount)

  await Promise.all(
    approved.map((app, i) =>
      prisma.tournamentApplication.update({ where: { id: app.id }, data: { seed: i + 1 } })
    )
  )

  const byId: Record<number, string | null> = {}
  for (let s = 1; s <= slotCount; s++) byId[s] = approved[s - 1]?.id ?? null

  await prisma.tournamentMatch.deleteMany({ where: { tournamentId } })

  // Winners bracket
  const pairs = seededBracket(slotCount)
  const wb1 = await Promise.all(
    pairs.map((pair, pos) => {
      const [s1, s2] = pair
      const p1 = byId[s1] ?? null
      const p2 = byId[s2] ?? null
      return prisma.tournamentMatch.create({
        data: {
          tournamentId, round: 1, position: pos + 1, bracket: 'W',
          p1Id: p1, p2Id: p2,
          status:   (!p1 || !p2) ? 'DONE' : 'SCHEDULED',
          winnerId: !p1 ? p2 : !p2 ? p1 : null,
        },
      })
    })
  )

  let prevCount = wb1.length
  for (let r = 2; r <= wbRounds; r++) {
    prevCount = Math.ceil(prevCount / 2)
    await Promise.all(
      Array.from({ length: prevCount }, (_, i) =>
        prisma.tournamentMatch.create({
          data: { tournamentId, round: r, position: i + 1, bracket: 'W', status: 'PENDING' },
        })
      )
    )
  }

  // Losers bracket: 2*(wbRounds-1) rounds
  let lbCount = Math.max(1, slotCount / 4)
  for (let lr = 1; lr <= 2 * (wbRounds - 1); lr++) {
    await Promise.all(
      Array.from({ length: lbCount }, (_, i) =>
        prisma.tournamentMatch.create({
          data: { tournamentId, round: lr, position: i + 1, bracket: 'L', status: 'PENDING' },
        })
      )
    )
    if (lr % 2 === 0) lbCount = Math.max(1, Math.ceil(lbCount / 2))
  }

  // Grand Final
  await prisma.tournamentMatch.create({
    data: { tournamentId, round: 1, position: 1, bracket: 'GF', status: 'PENDING' },
  })
}

// ── Main generateBracket ─────────────────────────────────────────────────────

export async function generateBracket(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where:   { id: tournamentId },
    include: { applications: { where: { status: 'APPROVED' }, orderBy: { skillScore: 'desc' } } },
  })

  const approved    = tournament.applications
  if (approved.length < 2) throw new Error('Нужно минимум 2 участника')

  const bracketType = tournament.bracketType ?? 'SINGLE_ELIMINATION'

  if (bracketType === 'ROUND_ROBIN')        await generateRoundRobinBracket(tournamentId, approved)
  else if (bracketType === 'DOUBLE_ELIMINATION') await generateDoubleElimBracket(tournamentId, approved)
  else                                       await generateSingleElimBracket(tournamentId, approved)

  await prisma.tournament.update({
    where: { id: tournamentId },
    data:  { bracketGeneratedAt: new Date(), status: 'ACTIVE' },
  })
}

// ── Advance winner ────────────────────────────────────────────────────────────

export async function advanceWinner(matchId: string, winnerId: string): Promise<void> {
  const match = await prisma.tournamentMatch.findUniqueOrThrow({
    where:   { id: matchId },
    include: { tournament: true },
  })

  await prisma.tournamentMatch.update({ where: { id: matchId }, data: { winnerId, status: 'DONE' } })

  const bracketType = match.tournament.bracketType ?? 'SINGLE_ELIMINATION'

  // Round robin — check if all done
  if (bracketType === 'ROUND_ROBIN') {
    const undone = await prisma.tournamentMatch.count({
      where: { tournamentId: match.tournamentId, status: { not: 'DONE' } },
    })
    if (undone === 0) await determineRoundRobinWinner(match.tournamentId)
    return
  }

  // Grand final done
  if (match.bracket === 'GF') {
    await distributePrizes(match.tournamentId, winnerId)
    await prisma.tournament.update({ where: { id: match.tournamentId }, data: { status: 'DONE' } })
    return
  }

  const nextRound    = match.round + 1
  const nextPosition = Math.ceil(match.position / 2)

  const nextMatch = await prisma.tournamentMatch.findFirst({
    where: { tournamentId: match.tournamentId, round: nextRound, position: nextPosition, bracket: match.bracket },
  })

  if (!nextMatch) {
    if (match.bracket === 'W' && bracketType === 'DOUBLE_ELIMINATION') {
      // WB final → Grand Final p1
      const gf = await prisma.tournamentMatch.findFirst({
        where: { tournamentId: match.tournamentId, bracket: 'GF' },
      })
      if (gf) await prisma.tournamentMatch.update({ where: { id: gf.id }, data: { p1Id: winnerId, status: 'SCHEDULED' } })
      return
    }
    if (match.bracket === 'L' && bracketType === 'DOUBLE_ELIMINATION') {
      // LB final → Grand Final p2
      const gf = await prisma.tournamentMatch.findFirst({
        where: { tournamentId: match.tournamentId, bracket: 'GF' },
      })
      if (gf) {
        const updated = await prisma.tournamentMatch.update({
          where: { id: gf.id },
          data:  { p2Id: winnerId },
        })
        if (updated.p1Id && updated.p2Id) {
          await prisma.tournamentMatch.update({ where: { id: gf.id }, data: { status: 'SCHEDULED' } })
        }
      }
      return
    }
    // Single elim final
    await distributePrizes(match.tournamentId, winnerId)
    await prisma.tournament.update({ where: { id: match.tournamentId }, data: { status: 'DONE' } })
    return
  }

  const isLeft = match.position % 2 === 1
  const updated = await prisma.tournamentMatch.update({
    where: { id: nextMatch.id },
    data:  { ...(isLeft ? { p1Id: winnerId } : { p2Id: winnerId }) },
  })
  if (updated.p1Id && updated.p2Id) {
    await prisma.tournamentMatch.update({ where: { id: nextMatch.id }, data: { status: 'SCHEDULED' } })
  }

  // Double elim: drop loser to LB
  if (bracketType === 'DOUBLE_ELIMINATION' && match.bracket === 'W') {
    const loserId = match.p1Id === winnerId ? match.p2Id : match.p1Id
    if (loserId) await assignToLosersBracket(match, loserId)
  }
}

async function assignToLosersBracket(
  wbMatch: { tournamentId: string; round: number; position: number },
  loserId: string,
): Promise<void> {
  const lbRound    = 2 * wbMatch.round - 1
  const lbPosition = Math.ceil(wbMatch.position / 2)

  const lbMatch = await prisma.tournamentMatch.findFirst({
    where: { tournamentId: wbMatch.tournamentId, round: lbRound, bracket: 'L', position: lbPosition },
  })
  if (!lbMatch) return

  const isLeft  = wbMatch.position % 2 === 1
  const updated = await prisma.tournamentMatch.update({
    where: { id: lbMatch.id },
    data:  { ...(isLeft ? { p1Id: loserId } : { p2Id: loserId }) },
  })
  if (updated.p1Id && updated.p2Id) {
    await prisma.tournamentMatch.update({ where: { id: lbMatch.id }, data: { status: 'SCHEDULED' } })
  }
}

async function determineRoundRobinWinner(tournamentId: string): Promise<void> {
  const matches = await prisma.tournamentMatch.findMany({
    where: { tournamentId, status: 'DONE', winnerId: { not: null } },
  })
  const winCount: Record<string, number> = {}
  for (const m of matches) {
    if (m.winnerId) winCount[m.winnerId] = (winCount[m.winnerId] ?? 0) + 1
  }
  const topWinnerId = Object.entries(winCount).sort(([, a], [, b]) => b - a)[0]?.[0]
  if (topWinnerId) await distributePrizes(tournamentId, topWinnerId)
  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'DONE' } })
}

// ── Prize distribution ────────────────────────────────────────────────────────

export async function distributePrizes(tournamentId: string, winnerId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } })
  if (!tournament) return

  const winnerApp = await prisma.tournamentApplication.findUnique({
    where:  { id: winnerId },
    select: { userId: true },
  })
  if (!winnerApp?.userId) return

  if (tournament.prizeXp > 0) {
    await prisma.user.update({
      where: { id: winnerApp.userId },
      data:  { totalXp: { increment: tournament.prizeXp } },
    })
  }

  const { createNotification } = await import('../services/notifications.js')
  await createNotification(winnerApp.userId, 'tournament_win', {
    tournamentId,
    tournamentName: tournament.name,
    prizeXp:        tournament.prizeXp,
    prizeSkin:      tournament.prizeSkin ?? null,
  }).catch(() => {})
}

// ── Cron tasks ────────────────────────────────────────────────────────────────

export async function checkAndGeneratePendingBrackets(): Promise<void> {
  const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
  const due = await prisma.tournament.findMany({
    where: { status: 'CLOSED', startDate: { lte: tenDaysFromNow } },
  })
  for (const t of due) {
    try {
      await generateBracket(t.id)
      console.log(`[tournament] Auto-generated bracket for "${t.name}"`)
    } catch (e) {
      console.error(`[tournament] Bracket generation failed for ${t.id}:`, e)
    }
  }
}

export async function spawnRecurringInstances(): Promise<void> {
  const templates = await prisma.tournament.findMany({
    where: { isRecurring: true, status: 'DONE' },
  })
  const now = new Date()
  for (const t of templates) {
    if (!t.recurringInterval) continue
    const intervalMs = t.recurringInterval === 'weekly'
      ? 7 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000

    const recent = await prisma.tournament.findFirst({
      where: { parentTournamentId: t.id, createdAt: { gte: new Date(now.getTime() - intervalMs) } },
    })
    if (recent) continue

    const newStart    = new Date(t.startDate.getTime() + intervalMs)
    const newDeadline = new Date(t.registrationDeadline.getTime() + intervalMs)
    await prisma.tournament.create({
      data: {
        name: t.name, description: t.description,
        startDate: newStart, registrationDeadline: newDeadline,
        maxParticipants: t.maxParticipants, format: t.format, level: t.level,
        bracketType: t.bracketType, prizeXp: t.prizeXp, prizeSkin: t.prizeSkin,
        isRecurring: true, recurringInterval: t.recurringInterval,
        parentTournamentId: t.id, status: 'REGISTRATION',
      },
    })
    console.log(`[tournament] Spawned recurring instance of "${t.name}"`)
  }
}
