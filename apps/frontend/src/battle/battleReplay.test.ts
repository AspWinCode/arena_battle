import type { RoundResult, TurnResult } from '@robocode/shared'
import { describe, expect, it } from 'vitest'
import { buildBattleReplay, buildTurnReplay } from './battleReplay'

function makeTurn(partial: Partial<TurnResult>): TurnResult {
  return {
    turn: 1,
    p1Action: 'attack',
    p2Action: 'shield',
    p1DmgTaken: 0,
    p2DmgTaken: 12,
    p1HpAfter: 70,
    p2HpAfter: 58,
    p1Heal: 0,
    p2Heal: 0,
    p1Stamina: 90,
    p2Stamina: 80,
    p1Rage: 0,
    p2Rage: 4,
    p1Position: 'close',
    p2Position: 'mid',
    log: 'test',
    ...partial,
  }
}

describe('battle replay converter', () => {
  it('builds action, damage, status and vfx events for a turn', () => {
    const replayTurn = buildTurnReplay(makeTurn({}))
    expect(replayTurn.events).toEqual([
      { actor: 'p1', type: 'move', to: 'close' },
      { actor: 'p2', type: 'move', to: 'mid' },
      { actor: 'p1', type: 'action', action: 'attack' },
      { actor: 'p2', type: 'action', action: 'shield' },
      { actor: 'p2', type: 'status', status: 'shield' },
      { actor: 'p2', type: 'vfx', effect: 'shield_up' },
      { actor: 'p2', type: 'damage', amount: 12, isCrit: false },
      { actor: 'p2', type: 'vfx', effect: 'hit_normal' },
    ])
  })

  it('emits move events only when positions change after the first turn', () => {
    const previous = makeTurn({ turn: 1, p1Position: 'mid', p2Position: 'mid' })
    const current = makeTurn({ turn: 2, p1Position: 'mid', p2Position: 'far' })
    const replayTurn = buildTurnReplay(current, previous)

    expect(replayTurn.events[0]).toEqual({ actor: 'p2', type: 'move', to: 'far' })
    expect(replayTurn.events.find((event) => event.type === 'move' && event.actor === 'p1')).toBeUndefined()
  })

  it('emits heal, poison and ko events', () => {
    const replayTurn = buildTurnReplay(
      makeTurn({
        p1Action: 'repair',
        p1Heal: 20,
        p2PoisonDmg: 4,
        p2HpAfter: 0,
        p2DmgTaken: 24,
      }),
    )

    expect(replayTurn.events).toContainEqual({ actor: 'p1', type: 'heal', amount: 20 })
    expect(replayTurn.events).toContainEqual({ actor: 'p1', type: 'vfx', effect: 'heal' })
    expect(replayTurn.events).toContainEqual({ actor: 'p2', type: 'status', status: 'poison' })
    expect(replayTurn.events).toContainEqual({ actor: 'p2', type: 'vfx', effect: 'poison_tick' })
    expect(replayTurn.events).toContainEqual({ actor: 'p2', type: 'ko' })
    expect(replayTurn.events).toContainEqual({ actor: 'p2', type: 'vfx', effect: 'ko_impact' })
  })

  it('builds a round replay and appends victory event for the winner', () => {
    const round: RoundResult = {
      round: 1,
      winner: 1,
      p1Hp: 50,
      p2Hp: 0,
      reason: 'ko',
      turns: [
        makeTurn({ turn: 1, p1Position: 'mid', p2Position: 'mid', p2DmgTaken: 10, p2HpAfter: 60 }),
        makeTurn({ turn: 2, p1Position: 'close', p2Position: 'mid', p2DmgTaken: 22, p2HpAfter: 0 }),
      ],
    }

    const replay = buildBattleReplay([round])

    expect(replay.rounds).toHaveLength(1)
    expect(replay.rounds[0].turns).toHaveLength(2)
    expect(replay.events[replay.events.length - 1]).toEqual({ actor: 'p1', type: 'victory' })
  })
})
