import { describe, it, expect } from 'vitest'
import { BattleEngine, runMatch } from './battle-engine.js'
import type { Strategy } from '@robocode/shared'

const aggressiveStrategy: Strategy = {
  primary: 'laser',
  lowHp: 'combo',
  onHit: 'dodge',
  style: 'Aggressive',
  position: 'far',
}

const defensiveStrategy: Strategy = {
  primary: 'shield',
  lowHp: 'repair',
  onHit: 'shield',
  style: 'Defensive',
  position: 'mid',
}

const attackerStrategy: Strategy = {
  primary: 'attack',
  lowHp: 'combo',
  onHit: 'dodge',
  style: 'Standard',
  position: 'close',
}

describe('BattleEngine', () => {
  it('should produce a winner in a round', () => {
    const engine = new BattleEngine(aggressiveStrategy, defensiveStrategy)
    const result = engine.runRound(1)

    expect(result.round).toBe(1)
    expect([0, 1, 2]).toContain(result.winner)
    expect(result.turns.length).toBeGreaterThan(0)
    expect(result.turns.length).toBeLessThanOrEqual(20)
  })

  it('should have HP >= 0 after round', () => {
    const engine = new BattleEngine(aggressiveStrategy, attackerStrategy)
    const result = engine.runRound(1)
    expect(result.p1Hp).toBeGreaterThanOrEqual(0)
    expect(result.p2Hp).toBeGreaterThanOrEqual(0)
  })

  it('turn results should have valid structure', () => {
    const engine = new BattleEngine(attackerStrategy, aggressiveStrategy)
    const result = engine.runRound(1)

    for (const turn of result.turns) {
      expect(turn.turn).toBeGreaterThan(0)
      expect(turn.p1HpAfter).toBeGreaterThanOrEqual(0)
      expect(turn.p2HpAfter).toBeGreaterThanOrEqual(0)
      expect(turn.p1DmgTaken).toBeGreaterThanOrEqual(0)
      expect(turn.p2DmgTaken).toBeGreaterThanOrEqual(0)
      expect(typeof turn.log).toBe('string')
    }
  })

  it('runMatch BO3 should not exceed 3 rounds', () => {
    const { winner, score, rounds } = runMatch(aggressiveStrategy, defensiveStrategy, 'bo3')
    expect(rounds.length).toBeLessThanOrEqual(3)
    expect([1, 2, 0]).toContain(winner)
    expect(score[0] + score[1]).toBeGreaterThan(0)
  })

  it('runMatch BO1 should have exactly 1 round', () => {
    const { rounds } = runMatch(attackerStrategy, aggressiveStrategy, 'bo1')
    expect(rounds.length).toBe(1)
  })

  it('winner of bo3 should have more wins', () => {
    const { winner, score } = runMatch(aggressiveStrategy, defensiveStrategy, 'bo3')
    if (winner === 1) expect(score[0]).toBeGreaterThan(score[1])
    if (winner === 2) expect(score[1]).toBeGreaterThan(score[0])
  })
})

describe('buildStrategy', () => {
  it('should handle combo strategy', () => {
    const comboStrat: Strategy = { primary: 'combo', lowHp: 'attack', onHit: 'dodge', style: 'Balanced', position: 'close' }
    const engine = new BattleEngine(comboStrat, defensiveStrategy)
    const result = engine.runRound(1)
    expect(result).toBeDefined()
  })
})
