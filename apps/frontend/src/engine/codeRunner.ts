import type { Strategy, StrategyContext, ActionName, Position } from '@robocode/shared'

const VALID_ACTIONS = new Set<ActionName>(['attack', 'laser', 'shield', 'dodge', 'combo', 'repair'])

function isValidAction(v: unknown): v is ActionName {
  return typeof v === 'string' && VALID_ACTIONS.has(v as ActionName)
}

// ── Test contexts used to probe static strategies ─────────────────────────────

const MOCK_CTX_NORMAL: StrategyContext = {
  myHp: 80, enemyHp: 60, turn: 1,
  myLastAction: null, enemyLastAction: null,
  cooldowns: { attack: 0, laser: 0, shield: 0, dodge: 0, combo: 0, repair: 0 },
  myPosition: 'mid', enemyPosition: 'mid', myRepeatCount: 0,
}

const MOCK_CTX_LOW_HP: StrategyContext = {
  myHp: 20, enemyHp: 80, turn: 7,
  myLastAction: 'attack', enemyLastAction: 'laser',
  cooldowns: { attack: 0, laser: 0, shield: 0, dodge: 0, combo: 0, repair: 0 },
  myPosition: 'mid', enemyPosition: 'far', myRepeatCount: 0,
}

// ── Dynamic strategy: extracts strategy(ctx) function ─────────────────────────

function hasDynamicStrategy(code: string): boolean {
  return /function\s+strategy\s*\(/.test(code)
    || /(?:const|let|var)\s+strategy\s*=\s*(?:function|\(|ctx\s*=>)/.test(code)
}

function buildDynamicStrategy(code: string): { strategy: Strategy; error?: string } {
  try {
    // eslint-disable-next-line no-new-func
    const setup = new Function(`
      "use strict";
      ${code}
      if (typeof strategy !== 'function') throw new Error('strategy() function not found');
      return strategy;
    `)

    const userFn = setup() as (ctx: StrategyContext) => unknown

    // Validate: call with test contexts to check it returns valid actions
    const r1 = userFn(MOCK_CTX_NORMAL)
    const r2 = userFn(MOCK_CTX_LOW_HP)

    if (!isValidAction(r1)) {
      return {
        strategy: defaultStrategy(),
        error: `strategy() вернула "${r1}" — ожидается одно из: attack, laser, shield, dodge, combo, repair`,
      }
    }

    // Build static fallbacks from the two test runs
    const primary: ActionName = isValidAction(r1) ? r1 : 'attack'
    const lowHp:   ActionName = isValidAction(r2) ? r2 : primary

    const fn = (ctx: StrategyContext): ActionName => {
      try {
        const result = userFn(ctx)
        return isValidAction(result) ? result : primary
      } catch {
        return primary
      }
    }

    // Derive position hint and style from test outputs
    const position: Position = 'mid'
    const style: Strategy['style'] =
      primary === 'laser'  ? 'Aggressive' :
      primary === 'dodge'  ? 'Evasive' :
      primary === 'shield' ? 'Defensive' :
      primary === 'combo'  ? 'Balanced' : 'Standard'

    return {
      strategy: { primary, lowHp, onHit: 'dodge', style, position, fn },
    }
  } catch (e) {
    return {
      strategy: defaultStrategy(),
      error: e instanceof Error ? e.message : 'Ошибка в коде',
    }
  }
}

// ── Static strategy: legacy onRoundStart / function call extraction ───────────

interface ActionCall { action: string }

function buildStaticStrategy(code: string): { strategy: Strategy; error?: string } {
  const calls: ActionCall[] = []

  const makeAction = (name: string) => () => {
    calls.push({ action: name })
    return name
  }

  // Legacy enemy object (for onRoundStart(enemy) style code)
  const mockEnemyNormal = {
    hp: 60, lastAction: null as ActionName | null,
    shieldActive: false, cooldowns: { laser: 0, combo: 0, repair: 0, shield: 0 },
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'attack', 'laser', 'shield', 'dodge', 'combo', 'repair',
      'moveForward', 'moveBackward', '__enemy__',
      `"use strict";
      ${code}
      if (typeof onRoundStart === 'function') {
        try { onRoundStart(__enemy__); } catch(e) {}
      }`,
    )

    fn(
      makeAction('attack'), makeAction('laser'), makeAction('shield'),
      makeAction('dodge'), makeAction('combo'), makeAction('repair'),
      makeAction('moveForward'), makeAction('moveBackward'),
      mockEnemyNormal,
    )

    // Also simulate low-hp scenario
    const callsLow: ActionCall[] = []
    const makeLow  = (name: string) => () => { callsLow.push({ action: name }); return name }
    const mockLow  = { ...mockEnemyNormal, hp: 20 }

    // eslint-disable-next-line no-new-func
    const fn2 = new Function(
      'attack', 'laser', 'shield', 'dodge', 'combo', 'repair',
      'moveForward', 'moveBackward', '__enemy__',
      `"use strict";
      ${code}
      if (typeof onRoundStart === 'function') {
        try { onRoundStart(__enemy__); } catch(e) {}
      }`,
    )
    fn2(
      makeLow('attack'), makeLow('laser'), makeLow('shield'),
      makeLow('dodge'), makeLow('combo'), makeLow('repair'),
      makeLow('moveForward'), makeLow('moveBackward'),
      mockLow,
    )

    const combatCalls = calls.filter(c => VALID_ACTIONS.has(c.action as ActionName))
    const primary: ActionName = (combatCalls[0]?.action as ActionName) ?? 'attack'

    const lowCombat = callsLow.filter(c => VALID_ACTIONS.has(c.action as ActionName))
    const lowHp: ActionName = (lowCombat[0]?.action as ActionName) ?? primary

    const allCalls = [...combatCalls, ...lowCombat]
    const hasDodge  = allCalls.some(c => c.action === 'dodge')
    const hasShield = allCalls.some(c => c.action === 'shield')
    const onHit: ActionName = hasDodge ? 'dodge' : hasShield ? 'shield' : 'attack'

    const hasFar   = calls.some(c => c.action === 'moveBackward' || c.action === 'laser')
    const hasClose = calls.some(c => c.action === 'attack' || c.action === 'combo')
    const position: Position = hasFar ? 'far' : hasClose ? 'close' : 'mid'

    const style: Strategy['style'] =
      primary === 'laser'  ? 'Aggressive' :
      primary === 'shield' ? 'Defensive' :
      primary === 'dodge'  ? 'Evasive' :
      primary === 'combo'  ? 'Balanced' : 'Standard'

    return { strategy: { primary, lowHp, onHit, style, position } }
  } catch (e) {
    return {
      strategy: defaultStrategy(),
      error: e instanceof Error ? e.message : 'Ошибка в коде',
    }
  }
}

// ── Default fallback ──────────────────────────────────────────────────────────

function defaultStrategy(): Strategy {
  return { primary: 'attack', lowHp: 'combo', onHit: 'dodge', style: 'Standard', position: 'mid' }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function runCodeToStrategy(code: string): { strategy: Strategy; error?: string } {
  if (!code.trim()) {
    return { strategy: defaultStrategy(), error: 'Код не написан' }
  }

  if (hasDynamicStrategy(code)) {
    return buildDynamicStrategy(code)
  }

  return buildStaticStrategy(code)
}
