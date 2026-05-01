import type { RoundResult, ActionName } from '@robocode/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionBreakdown {
  action: ActionName
  count: number
  pct: number       // 0–100
  dmgDealt: number
}

export interface PlayerAnalysis {
  // Action breakdown sorted by count desc
  actions: ActionBreakdown[]
  dominantAction: ActionName

  // Damage
  damageDealt: number
  damageReceived: number
  healingDone: number

  // Defensive stats
  shieldTurns: number         // turns where action=shield
  dodgeTurns: number          // turns where action=dodge
  shieldBlocked: number       // estimated damage saved by shield (60% absorb)
  dodgeEvades: number         // turns where dodge + 0 damage received

  // Offensive stats
  specialCount: number
  heavyCount: number
  laserCount: number

  // Penalties
  repeatPenalties: number     // turns with same action 3+ in a row

  // Efficiency score 0–100
  efficiencyScore: number

  // Detected style tag
  detectedStyle: string

  // AI recommendations (2–4 items)
  recommendations: string[]
}

export interface HpPoint { turn: number; p1Hp: number; p2Hp: number }

export interface MatchAnalysis {
  p1: PlayerAnalysis
  p2: PlayerAnalysis
  hpTimeline: HpPoint[][]  // one array per round
  totalTurns: number
  totalDamage: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ALL_ACTIONS: ActionName[] = ['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special']
const REPEAT_THRESHOLD = 3

// ── Core computation ──────────────────────────────────────────────────────────

function computePlayer(
  rounds: RoundResult[],
  player: 1 | 2,
): PlayerAnalysis {
  const other = player === 1 ? 2 : 1

  const actKey   = (p: 1 | 2) => `p${p}Action`  as `p${1|2}Action`
  const dmgKey   = (p: 1 | 2) => `p${p}DmgTaken` as `p${1|2}DmgTaken`
  const healKey  = (p: 1 | 2) => `p${p}Heal`     as `p${1|2}Heal`
  const hpKey    = (p: 1 | 2) => `p${p}HpAfter`  as `p${1|2}HpAfter`

  const counts: Record<string, number>   = {}
  const dmgByAction: Record<string, number> = {}
  let damageDealt    = 0
  let damageReceived = 0
  let healingDone    = 0
  let shieldTurns    = 0
  let dodgeTurns     = 0
  let shieldBlocked  = 0
  let dodgeEvades    = 0
  let repeatPenalties = 0

  for (const round of rounds) {
    let prevAction: string | null = null
    let streak = 0

    for (const t of round.turns) {
      const myAct   = t[actKey(player)]   as ActionName
      const oppAct  = t[actKey(other)]    as ActionName
      const myDmg   = t[dmgKey(player)]   as number    // damage I took
      const oppDmg  = t[dmgKey(other)]    as number    // damage I dealt
      const myHeal  = t[healKey(player)]  as number

      // counts
      counts[myAct]    = (counts[myAct] ?? 0) + 1
      // damage dealt by my action
      dmgByAction[myAct] = (dmgByAction[myAct] ?? 0) + oppDmg

      damageDealt    += oppDmg
      damageReceived += myDmg
      healingDone    += myHeal

      // shield
      if (myAct === 'shield') {
        shieldTurns++
        // shield absorbed 60% of what would have been dealt
        // oppAct was attacker — estimate from actual damage received
        if (myDmg > 0) shieldBlocked += Math.round(myDmg * 0.6 / 0.4)
        else if (oppAct !== 'shield' && oppAct !== 'dodge' && oppAct !== 'repair') {
          shieldBlocked += 0 // could not determine, skip
        }
      }

      // dodge evade
      if (myAct === 'dodge') {
        dodgeTurns++
        if (myDmg === 0) dodgeEvades++
      }

      // repeat penalty tracking
      if (myAct === prevAction) {
        streak++
        if (streak >= REPEAT_THRESHOLD) repeatPenalties++
      } else {
        streak = 1
        prevAction = myAct
      }
    }
  }

  const totalTurns = Object.values(counts).reduce((a, b) => a + b, 0)

  // Build action breakdown
  const actions: ActionBreakdown[] = ALL_ACTIONS
    .filter(a => (counts[a] ?? 0) > 0)
    .map(a => ({
      action: a,
      count: counts[a] ?? 0,
      pct: totalTurns > 0 ? Math.round(((counts[a] ?? 0) / totalTurns) * 100) : 0,
      dmgDealt: dmgByAction[a] ?? 0,
    }))
    .sort((a, b) => b.count - a.count)

  const dominantAction = actions[0]?.action ?? 'attack'
  const specialCount   = counts['special'] ?? 0
  const heavyCount     = counts['heavy']   ?? 0
  const laserCount     = counts['laser']   ?? 0

  // ── Style detection ────────────────────────────────────────────
  const aggPct   = ((counts['attack'] ?? 0) + (counts['heavy'] ?? 0) + (counts['laser'] ?? 0)) / Math.max(1, totalTurns)
  const defPct   = ((counts['shield'] ?? 0) + (counts['dodge'] ?? 0)) / Math.max(1, totalTurns)
  const healPct  = (counts['repair'] ?? 0) / Math.max(1, totalTurns)

  const detectedStyle =
    specialCount >= 2                ? '⚡ Rage Fighter'   :
    heavyCount >= totalTurns * 0.25  ? '💥 Heavy Puncher'  :
    laserCount >= totalTurns * 0.25  ? '🔫 Sniper'         :
    healPct  >= 0.2                  ? '💚 Sustainer'       :
    defPct   >= 0.3 && aggPct < 0.5  ? '🛡️ Turtle'         :
    aggPct   >= 0.7                  ? '⚔️ Berserker'       :
                                       '⚖️ Balanced'

  // ── Efficiency score ───────────────────────────────────────────
  // Factors: damage ratio, healing efficiency, dodging, avoiding repeats
  const dmgRatio      = damageReceived > 0 ? Math.min(2, damageDealt / damageReceived) : 2
  const repeatPenPct  = totalTurns > 0 ? repeatPenalties / totalTurns : 0
  const dodgeEff      = dodgeTurns > 0 ? dodgeEvades / dodgeTurns : 1

  const efficiencyScore = Math.round(
    Math.min(100, Math.max(0,
      dmgRatio * 35            // up to 70 pts for dmg ratio
      + dodgeEff * 15          // up to 15 pts for dodge effectiveness
      + (1 - repeatPenPct) * 15 // up to 15 pts for action variety
    ))
  )

  // ── Recommendations ────────────────────────────────────────────
  const recs: string[] = []

  if (specialCount === 0)
    recs.push('💡 Накапливай ярость до 100 — Special наносит 50 урона!')

  if (repeatPenalties >= 3)
    recs.push('⚠️ Повтор одного действия 3+ раз даёт штраф ×0.5 урона — чередуй атаки')

  if (damageReceived > 0 && dodgeTurns === 0)
    recs.push('💡 Dodge уклоняется от атаки и тяжёлого удара на 100%')

  if (heavyCount === 0 && totalTurns >= 5)
    recs.push('💡 Heavy наносит 28 урона (×1.5 при CLOSE = 42!) — используй на короткой дистанции')

  if (laserCount === 0 && counts['attack'] && (counts['attack'] ?? 0) > totalTurns * 0.4)
    recs.push('💡 Laser эффективен на дальней дистанции: ×1.4 урона при FAR')

  if (shieldTurns > totalTurns * 0.25 && damageDealt < damageReceived)
    recs.push('💡 Слишком много блоков при малом уроне — Shield не контратакует, нужен баланс')

  if (healingDone === 0 && damageReceived > 50)
    recs.push('💡 Repair восстанавливает 20 HP — используй при HP < 30 для затяжных боёв')

  if (damageDealt > damageReceived * 1.5 && damageReceived > 30)
    recs.push('✨ Отличный урон! Попробуй Shield/Dodge чтобы продержаться дольше')

  // trim to 3 best
  const finalRecs = recs.slice(0, 3)
  if (finalRecs.length === 0) finalRecs.push('✨ Отличная стратегия — продолжай в том же духе!')

  return {
    actions,
    dominantAction,
    damageDealt,
    damageReceived,
    healingDone,
    shieldTurns,
    dodgeTurns,
    shieldBlocked,
    dodgeEvades,
    specialCount,
    heavyCount,
    laserCount,
    repeatPenalties,
    efficiencyScore,
    detectedStyle,
    recommendations: finalRecs,
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function analyzeMatch(rounds: RoundResult[]): MatchAnalysis {
  const p1 = computePlayer(rounds, 1)
  const p2 = computePlayer(rounds, 2)

  const hpTimeline: HpPoint[][] = rounds.map(r => {
    const pts: HpPoint[] = [{ turn: 0, p1Hp: 100, p2Hp: 100 }]
    for (const t of r.turns) {
      pts.push({ turn: t.turn, p1Hp: t.p1HpAfter, p2Hp: t.p2HpAfter })
    }
    return pts
  })

  const totalTurns  = rounds.reduce((a, r) => a + r.turns.length, 0)
  const totalDamage = rounds.reduce((a, r) =>
    a + r.turns.reduce((b, t) => b + t.p1DmgTaken + t.p2DmgTaken, 0), 0)

  return { p1, p2, hpTimeline, totalTurns, totalDamage }
}

// ── Labels / colors ───────────────────────────────────────────────────────────

export const ACTION_LABEL: Record<ActionName, string> = {
  attack:  'Attack',
  heavy:   'Heavy',
  laser:   'Laser',
  shield:  'Shield',
  dodge:   'Dodge',
  repair:  'Repair',
  special: 'Special',
}

export const ACTION_COLOR: Record<ActionName, string> = {
  attack:  '#f87171',
  heavy:   '#fb923c',
  laser:   '#38bdf8',
  shield:  '#a78bfa',
  dodge:   '#34d399',
  repair:  '#4ade80',
  special: '#fbbf24',
}
