// ── ELO / XP / Level utilities ────────────────────────────────────────────────

const K_FACTOR = 32

/**
 * Calculate new ELO ratings after a match.
 * @param ratingA  - current ELO of winner
 * @param ratingB  - current ELO of loser
 * @returns        - new ratings and the delta for player A
 */
export function calcElo(ratingA: number, ratingB: number): {
  newA: number
  newB: number
  deltaA: number
} {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
  const deltaA = Math.round(K_FACTOR * (1 - expectedA))
  return {
    newA: Math.max(100, ratingA + deltaA),
    newB: Math.max(100, ratingB - deltaA),
    deltaA,
  }
}

/** XP awarded for a win (base + small bonus for beating higher-rated opponents) */
export function xpForWin(myElo: number, opponentElo: number): number {
  const bonus = Math.max(0, Math.round((opponentElo - myElo) / 20))
  return 50 + bonus
}

/** XP awarded for a loss (participation reward) */
export function xpForLoss(): number {
  return 15
}

/** Compute level from total XP: 500 XP per level, starts at 1 */
export function calcLevel(totalXp: number): number {
  return Math.min(100, Math.floor(totalXp / 500) + 1)
}

/** XP needed to reach next level from current totalXp */
export function xpToNextLevel(totalXp: number): { current: number; needed: number; pct: number } {
  const level = calcLevel(totalXp)
  const levelStart = (level - 1) * 500
  const levelEnd   = level * 500
  const current = totalXp - levelStart
  const needed  = levelEnd - levelStart
  return { current, needed, pct: Math.round((current / needed) * 100) }
}

/** Human-readable rank name based on ELO */
export function getRankName(elo: number): string {
  if (elo < 1000) return 'Новичок'
  if (elo < 1200) return 'Боец'
  if (elo < 1400) return 'Ветеран'
  if (elo < 1600) return 'Элита'
  return 'Легенда'
}

/** Rank colour for UI */
export function getRankColor(elo: number): string {
  if (elo < 1000) return '#888'
  if (elo < 1200) return '#00e676'
  if (elo < 1400) return '#ffe566'
  if (elo < 1600) return '#ff8c00'
  return '#ff3d3d'
}
