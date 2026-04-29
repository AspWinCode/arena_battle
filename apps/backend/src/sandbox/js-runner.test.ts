import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { ACTION_BRIDGE_SOURCE } from './js-runner.js'

describe('ACTION_BRIDGE_SOURCE', () => {
  it('exposes callable helpers for player JavaScript code', () => {
    const calls: Array<{ action: string; args: unknown[] }> = []
    const context = {
      __bridge_attack: {
        applySync: (_receiver: unknown, args: unknown[]) => calls.push({ action: 'attack', args }),
      },
      __bridge_combo: {
        applySync: (_receiver: unknown, args: unknown[]) => calls.push({ action: 'combo', args }),
      },
    }

    vm.runInNewContext(`
      ${ACTION_BRIDGE_SOURCE}
      function onRoundStart(enemy) {
        if (enemy.hp < 30) return combo();
        return attack('hook');
      }
      onRoundStart({ hp: 60 });
      onRoundStart({ hp: 20 });
    `, context)

    expect(calls).toEqual([
      { action: 'attack', args: ['hook'] },
      { action: 'combo', args: [] },
    ])
  })
})
