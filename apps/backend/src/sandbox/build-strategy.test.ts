import { describe, expect, it } from 'vitest'
import { buildStrategy } from './build-strategy.js'

describe('buildStrategy', () => {
  it('ignores move calls when deriving combat actions', () => {
    const strategy = buildStrategy([
      { action: 'moveForward' },
      { action: 'attack', type: 'hook' },
      { action: 'moveBackward' },
      { action: 'combo' },
    ])

    expect(strategy.primary).toBe('attack')
    expect(strategy.lowHp).toBe('combo')
    expect(strategy.position).toBe('far')
  })
})
