import type { Strategy, ActionName, Position } from '@robocode/shared'

interface ActionCall { action: string; arg?: string }

function buildStrategyFromCalls(calls: ActionCall[]): Strategy {
  const combat: ActionName[] = ['attack', 'laser', 'shield', 'dodge', 'combo', 'repair']
  const combatCalls = calls.filter(c => combat.includes(c.action as ActionName))

  const primary: ActionName = combatCalls[0]?.action as ActionName ?? 'attack'

  const lowHpCall = combatCalls[Math.floor(combatCalls.length * 0.7)]?.action as ActionName
  const onHitCall = combatCalls[1]?.action as ActionName

  const hasFar  = calls.some(c => c.action === 'moveBackward' || c.action === 'laser')
  const hasClose = calls.some(c => c.action === 'attack' || c.action === 'combo')
  const position: Position = hasFar ? 'far' : hasClose ? 'close' : 'mid'

  const style: Strategy['style'] =
    primary === 'laser' ? 'Aggressive' :
    primary === 'shield' ? 'Defensive' :
    primary === 'dodge'  ? 'Evasive' :
    primary === 'combo'  ? 'Aggressive' : 'Standard'

  return {
    primary,
    lowHp: lowHpCall ?? primary,
    onHit: onHitCall ?? 'dodge',
    style,
    position,
  }
}

export function runCodeToStrategy(code: string): { strategy: Strategy; error?: string } {
  const calls: ActionCall[] = []

  const makeAction = (name: string) => (arg?: string) => {
    calls.push({ action: name, arg })
    return name
  }

  const mockEnemy = {
    hp: 60,
    lastAction: null as ActionName | null,
    shieldActive: false,
    cooldowns: { laser: 0, combo: 0, repair: 0, shield: 0 },
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'attack', 'laser', 'shield', 'dodge', 'combo', 'repair',
      'moveForward', 'moveBackward',
      '__enemy__',
      `
      ${code}
      if (typeof onRoundStart === 'function') {
        try { onRoundStart(__enemy__); } catch(e) {}
      }
      `
    )

    fn(
      makeAction('attack'), makeAction('laser'), makeAction('shield'),
      makeAction('dodge'), makeAction('combo'), makeAction('repair'),
      makeAction('moveForward'), makeAction('moveBackward'),
      mockEnemy,
    )

    // Also simulate low-hp scenario
    const callsLow: ActionCall[] = []
    const makeLow = (name: string) => (arg?: string) => { callsLow.push({ action: name, arg }); return name }
    const mockLow = { ...mockEnemy, hp: 20 }

    // eslint-disable-next-line no-new-func
    const fn2 = new Function(
      'attack', 'laser', 'shield', 'dodge', 'combo', 'repair',
      'moveForward', 'moveBackward', '__enemy__',
      `${code}\nif (typeof onRoundStart === 'function') { try { onRoundStart(__enemy__); } catch(e) {} }`
    )
    fn2(
      makeLow('attack'), makeLow('laser'), makeLow('shield'),
      makeLow('dodge'), makeLow('combo'), makeLow('repair'),
      makeLow('moveForward'), makeLow('moveBackward'),
      mockLow,
    )

    const allCalls = [...calls, ...callsLow]
    const strategy = allCalls.length > 0
      ? buildStrategyFromCalls(allCalls)
      : { primary: 'attack' as ActionName, lowHp: 'combo' as ActionName, onHit: 'dodge' as ActionName, style: 'Standard' as const, position: 'mid' as Position }

    // Override lowHp from the low-hp scenario
    if (callsLow.length > 0) {
      const lowCombat = callsLow.filter(c => ['attack','laser','shield','dodge','combo','repair'].includes(c.action))
      if (lowCombat[0]) strategy.lowHp = lowCombat[0].action as ActionName
    }

    return { strategy }
  } catch (e) {
    return {
      strategy: { primary: 'attack', lowHp: 'combo', onHit: 'dodge', style: 'Standard', position: 'mid' },
      error: e instanceof Error ? e.message : 'Ошибка в коде',
    }
  }
}
