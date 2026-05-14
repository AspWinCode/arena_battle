import type { BattleEvent, RoundResult, TurnResult } from '@robocode/shared'

export interface ReplayTurn {
  turn: number
  events: BattleEvent[]
}

export interface ReplayRound {
  round: number
  winner: 0 | 1 | 2
  reason: 'ko' | 'time'
  turns: ReplayTurn[]
}

export interface BattleReplay {
  rounds: ReplayRound[]
  events: BattleEvent[]
}

function buildMoveEvents(turn: TurnResult, previousTurn?: TurnResult): BattleEvent[] {
  const events: BattleEvent[] = []

  if (!previousTurn || previousTurn.p1Position !== turn.p1Position) {
    events.push({ actor: 'p1', type: 'move', to: turn.p1Position })
  }
  if (!previousTurn || previousTurn.p2Position !== turn.p2Position) {
    events.push({ actor: 'p2', type: 'move', to: turn.p2Position })
  }

  return events
}

function buildActionEvents(turn: TurnResult): BattleEvent[] {
  return [
    { actor: 'p1', type: 'action', action: turn.p1Action },
    { actor: 'p2', type: 'action', action: turn.p2Action },
  ]
}

function buildStatusEvents(turn: TurnResult): BattleEvent[] {
  const events: BattleEvent[] = []

  if (turn.p1Action === 'shield' || turn.p1Action === 'reflect') {
    events.push({ actor: 'p1', type: 'status', status: 'shield' })
    events.push({ actor: 'p1', type: 'vfx', effect: 'shield_up' })
  }
  if (turn.p2Action === 'shield' || turn.p2Action === 'reflect') {
    events.push({ actor: 'p2', type: 'status', status: 'shield' })
    events.push({ actor: 'p2', type: 'vfx', effect: 'shield_up' })
  }

  if (turn.p1Action === 'special') {
    events.push({ actor: 'p1', type: 'vfx', effect: 'special_aura' })
  }
  if (turn.p2Action === 'special') {
    events.push({ actor: 'p2', type: 'vfx', effect: 'special_aura' })
  }

  if (turn.p1PoisonDmg && turn.p1PoisonDmg > 0) {
    events.push({ actor: 'p1', type: 'status', status: 'poison' })
    events.push({ actor: 'p1', type: 'vfx', effect: 'poison_tick' })
  }
  if (turn.p2PoisonDmg && turn.p2PoisonDmg > 0) {
    events.push({ actor: 'p2', type: 'status', status: 'poison' })
    events.push({ actor: 'p2', type: 'vfx', effect: 'poison_tick' })
  }

  return events
}

function buildDamageAndHealEvents(turn: TurnResult): BattleEvent[] {
  const events: BattleEvent[] = []

  if (turn.p1DmgTaken > 0) {
    events.push({
      actor: 'p1',
      type: 'damage',
      amount: turn.p1DmgTaken,
      isCrit: turn.p1DmgTaken >= 20,
    })
    events.push({
      actor: 'p1',
      type: 'vfx',
      effect: turn.p1DmgTaken >= 20 ? 'hit_crit' : 'hit_normal',
    })
  }

  if (turn.p2DmgTaken > 0) {
    events.push({
      actor: 'p2',
      type: 'damage',
      amount: turn.p2DmgTaken,
      isCrit: turn.p2DmgTaken >= 20,
    })
    events.push({
      actor: 'p2',
      type: 'vfx',
      effect: turn.p2DmgTaken >= 20 ? 'hit_crit' : 'hit_normal',
    })
  }

  if (turn.p1Heal > 0) {
    events.push({ actor: 'p1', type: 'heal', amount: turn.p1Heal })
    events.push({ actor: 'p1', type: 'vfx', effect: 'heal' })
  }
  if (turn.p2Heal > 0) {
    events.push({ actor: 'p2', type: 'heal', amount: turn.p2Heal })
    events.push({ actor: 'p2', type: 'vfx', effect: 'heal' })
  }

  return events
}

function buildResolutionEvents(turn: TurnResult): BattleEvent[] {
  const events: BattleEvent[] = []

  if (turn.p1HpAfter <= 0) {
    events.push({ actor: 'p1', type: 'ko' })
    events.push({ actor: 'p1', type: 'vfx', effect: 'ko_impact' })
  }
  if (turn.p2HpAfter <= 0) {
    events.push({ actor: 'p2', type: 'ko' })
    events.push({ actor: 'p2', type: 'vfx', effect: 'ko_impact' })
  }

  return events
}

export function buildTurnReplay(turn: TurnResult, previousTurn?: TurnResult): ReplayTurn {
  return {
    turn: turn.turn,
    events: [
      ...buildMoveEvents(turn, previousTurn),
      ...buildActionEvents(turn),
      ...buildStatusEvents(turn),
      ...buildDamageAndHealEvents(turn),
      ...buildResolutionEvents(turn),
    ],
  }
}

export function buildBattleReplay(rounds: RoundResult[]): BattleReplay {
  const replayRounds: ReplayRound[] = []
  const flatEvents: BattleEvent[] = []

  for (const round of rounds) {
    const replayTurns: ReplayTurn[] = []
    let previousTurn: TurnResult | undefined

    for (const turn of round.turns) {
      const replayTurn = buildTurnReplay(turn, previousTurn)
      replayTurns.push(replayTurn)
      flatEvents.push(...replayTurn.events)
      previousTurn = turn
    }

    if (round.winner === 1) {
      flatEvents.push({ actor: 'p1', type: 'victory' })
    } else if (round.winner === 2) {
      flatEvents.push({ actor: 'p2', type: 'victory' })
    }

    replayRounds.push({
      round: round.round,
      winner: round.winner,
      reason: round.reason,
      turns: replayTurns,
    })
  }

  return { rounds: replayRounds, events: flatEvents }
}
