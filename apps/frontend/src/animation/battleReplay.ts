/**
 * battleReplay.ts
 *
 * Converts the battle engine's RoundResult[] / TurnResult[] into a flat
 * BattleEvent[] that the AnimationPlayer can play back frame-by-frame,
 * completely decoupled from the battle engine.
 */

import type { RoundResult, TurnResult } from '@robocode/shared'
import type { BattleEvent, BattleActor, VFXType } from '@robocode/shared'
import { ACTION_TO_ANIMATION } from '@robocode/shared'

// ── Internal helpers ──────────────────────────────────────────────────────────

function actionVFX(action: string): VFXType | null {
  switch (action) {
    case 'special':        return 'special_aura'
    case 'shield':
    case 'reflect':
    case 'adaptive_shield': return 'shield_up'
    case 'overcharge':     return 'rage_gain'
    default: return null
  }
}

function damageVFX(amount: number, isCrit?: boolean): VFXType {
  if (isCrit || amount >= 40) return 'hit_crit'
  return 'hit_normal'
}

/**
 * Derive battle events for a single turn from the perspective of actor `me`
 * (attacker) and actor `them` (defender).
 */
function eventsForTurn(
  turn: TurnResult,
  me: BattleActor,
  them: BattleActor,
  myAction: 'p1Action' | 'p2Action',
  myDmg: 'p2DmgTaken' | 'p1DmgTaken',   // damage I deal = what they take
  theirDmg: 'p1DmgTaken' | 'p2DmgTaken', // damage I take
  myHeal: 'p1Heal' | 'p2Heal',
  myPoison: 'p1PoisonDmg' | 'p2PoisonDmg',
): BattleEvent[] {
  const events: BattleEvent[] = []
  const action = turn[myAction]

  // 1. Announce the action
  events.push({ actor: me, type: 'action', action })

  // 2. Optional VFX tied to the action itself (before damage resolves)
  const aVfx = actionVFX(action)
  if (aVfx) events.push({ actor: me, type: 'vfx', effect: aVfx })

  // 3. Shield status
  if (action === 'shield' || action === 'reflect' || action === 'adaptive_shield') {
    events.push({ actor: me, type: 'status', status: 'shield' })
  }

  // 4. Damage they receive from my action
  const dealt = turn[myDmg]
  if (dealt > 0) {
    const crit = dealt >= 40
    events.push({ actor: them, type: 'damage', amount: dealt, isCrit: crit })
    events.push({ actor: them, type: 'vfx', effect: damageVFX(dealt, crit) })
  }

  // 5. Heal I receive
  const healed = turn[myHeal]
  if (healed > 0) {
    events.push({ actor: me, type: 'heal', amount: healed })
    events.push({ actor: me, type: 'vfx', effect: 'heal' })
  }

  // 6. Poison damage I receive
  const poison = turn[myPoison] ?? 0
  if (poison > 0) {
    events.push({ actor: me, type: 'damage', amount: poison })
    events.push({ actor: me, type: 'vfx', effect: 'poison_tick' })
  }

  // 7. Rage status (when rage was consumed via special)
  if (action === 'special') {
    events.push({ actor: me, type: 'status', status: 'rage' })
  }

  return events
}

/**
 * Convert a single TurnResult into an interleaved sequence of BattleEvents.
 * P1 action resolves first, then P2. If either side dies the KO event follows.
 */
export function turnToEvents(turn: TurnResult): BattleEvent[] {
  const events: BattleEvent[] = []

  const p1Events = eventsForTurn(
    turn, 'p1', 'p2',
    'p1Action', 'p2DmgTaken', 'p1DmgTaken',
    'p1Heal', 'p1PoisonDmg',
  )
  const p2Events = eventsForTurn(
    turn, 'p2', 'p1',
    'p2Action', 'p1DmgTaken', 'p2DmgTaken',
    'p2Heal', 'p2PoisonDmg',
  )

  // Interleave: action events first (show both chars acting), then outcomes
  events.push(...p1Events)
  events.push(...p2Events)

  // KO checks
  if (turn.p1HpAfter <= 0) events.push({ actor: 'p1', type: 'ko' })
  if (turn.p2HpAfter <= 0) events.push({ actor: 'p2', type: 'ko' })

  return events
}

/**
 * Convert a full RoundResult into a flat BattleEvent[].
 * Each turn is separated — the AnimationPlayer paces them with timing.
 */
export function roundToEvents(round: RoundResult): BattleEvent[] {
  const events: BattleEvent[] = []
  for (const turn of round.turns) {
    events.push(...turnToEvents(turn))
  }
  // Victory event for the round winner
  if (round.winner === 1) events.push({ actor: 'p1', type: 'victory' })
  if (round.winner === 2) events.push({ actor: 'p2', type: 'victory' })
  return events
}

/**
 * Convert all rounds of a match into a flat BattleEvent[].
 */
export function matchToEvents(rounds: RoundResult[]): BattleEvent[] {
  return rounds.flatMap(roundToEvents)
}

// Re-export for convenience
export { ACTION_TO_ANIMATION }
