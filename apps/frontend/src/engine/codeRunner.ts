import type { Strategy, StrategyContext, ActionName, Position } from '@robocode/shared'

const VALID_ACTIONS = new Set<ActionName>([
  'attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special',
])

function isValidAction(v: unknown): v is ActionName {
  return typeof v === 'string' && VALID_ACTIONS.has(v as ActionName)
}

// ── Test contexts ──────────────────────────────────────────────────────────────

const MOCK_CTX_NORMAL: StrategyContext = {
  myHp: 80, myStamina: 100, myRage: 0,
  enemyHp: 60, enemyStamina: 100, enemyRage: 0,
  turn: 1,
  myLastAction: null, enemyLastAction: null,
  cooldowns: { attack: 0, heavy: 0, laser: 0, shield: 0, dodge: 0, repair: 0, special: 0 },
  myPosition: 'mid', enemyPosition: 'mid',
  myRepeatCount: 0,
}

const MOCK_CTX_LOW_HP: StrategyContext = {
  myHp: 20, myStamina: 30, myRage: 80,
  enemyHp: 70, enemyStamina: 60, enemyRage: 20,
  turn: 8,
  myLastAction: 'attack', enemyLastAction: 'heavy',
  cooldowns: { attack: 0, heavy: 0, laser: 0, shield: 0, dodge: 0, repair: 0, special: 0 },
  myPosition: 'close', enemyPosition: 'close',
  myRepeatCount: 2,
}

// ── Detect API style ──────────────────────────────────────────────────────────

function hasDynamicStrategy(code: string): boolean {
  return /function\s+strategy\s*\(/.test(code)
    || /(?:const|let|var)\s+strategy\s*=\s*(?:function|\(|ctx\s*=>)/.test(code)
}

// ── Dynamic strategy: strategy(ctx) ──────────────────────────────────────────

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

    const r1 = userFn(MOCK_CTX_NORMAL)
    const r2 = userFn(MOCK_CTX_LOW_HP)

    if (!isValidAction(r1)) {
      return {
        strategy: defaultStrategy(),
        error: `strategy() вернула "${r1}". Допустимые значения: attack, heavy, laser, shield, dodge, repair, special`,
      }
    }

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

    const style: Strategy['style'] =
      primary === 'laser' || primary === 'heavy' ? 'Aggressive' :
      primary === 'dodge'  ? 'Evasive' :
      primary === 'shield' ? 'Defensive' :
      primary === 'special' ? 'Balanced' : 'Standard'

    return {
      strategy: { primary, lowHp, onHit: 'dodge', style, position: 'mid', fn },
    }
  } catch (e) {
    return {
      strategy: defaultStrategy(),
      error: e instanceof Error ? e.message : 'Ошибка в коде',
    }
  }
}

// ── Static strategy: legacy call-capture approach ─────────────────────────────

interface ActionCall { action: string }

function buildStaticStrategy(code: string): { strategy: Strategy; error?: string } {
  const calls: ActionCall[] = []
  const makeAction = (name: string) => () => { calls.push({ action: name }); return name }

  const mockEnemyNormal = {
    hp: 60, stamina: 100, rage: 0,
    lastAction: null as ActionName | null,
    shieldActive: false,
    cooldowns: { heavy: 0, laser: 0, repair: 0, shield: 0, dodge: 0 },
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special',
      'moveForward', 'moveBackward', '__enemy__',
      `"use strict";
      ${code}
      if (typeof onRoundStart === 'function') {
        try { onRoundStart(__enemy__); } catch(e) {}
      }`,
    )
    fn(
      makeAction('attack'), makeAction('heavy'), makeAction('laser'),
      makeAction('shield'), makeAction('dodge'), makeAction('repair'), makeAction('special'),
      makeAction('moveForward'), makeAction('moveBackward'),
      mockEnemyNormal,
    )

    // Low-HP scenario
    const callsLow: ActionCall[] = []
    const makeLow = (name: string) => () => { callsLow.push({ action: name }); return name }
    // eslint-disable-next-line no-new-func
    const fn2 = new Function(
      'attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special',
      'moveForward', 'moveBackward', '__enemy__',
      `"use strict";
      ${code}
      if (typeof onRoundStart === 'function') {
        try { onRoundStart(__enemy__); } catch(e) {}
      }`,
    )
    fn2(
      makeLow('attack'), makeLow('heavy'), makeLow('laser'),
      makeLow('shield'), makeLow('dodge'), makeLow('repair'), makeLow('special'),
      makeLow('moveForward'), makeLow('moveBackward'),
      { ...mockEnemyNormal, hp: 20 },
    )

    const combatCalls = calls.filter(c => VALID_ACTIONS.has(c.action as ActionName))
    const lowCombat   = callsLow.filter(c => VALID_ACTIONS.has(c.action as ActionName))

    const primary: ActionName = (combatCalls[0]?.action as ActionName) ?? 'attack'
    const lowHp:   ActionName = (lowCombat[0]?.action  as ActionName) ?? primary

    const all = [...combatCalls, ...lowCombat]
    const hasDodge  = all.some(c => c.action === 'dodge')
    const hasShield = all.some(c => c.action === 'shield')
    const onHit: ActionName = hasDodge ? 'dodge' : hasShield ? 'shield' : 'attack'

    const hasFar   = calls.some(c => c.action === 'moveBackward' || c.action === 'laser')
    const hasClose = calls.some(c => c.action === 'attack' || c.action === 'heavy')
    const position: Position = hasFar ? 'far' : hasClose ? 'close' : 'mid'

    const style: Strategy['style'] =
      primary === 'laser' || primary === 'heavy' ? 'Aggressive' :
      primary === 'shield' ? 'Defensive' :
      primary === 'dodge'  ? 'Evasive' :
      primary === 'special' ? 'Balanced' : 'Standard'

    return { strategy: { primary, lowHp, onHit, style, position } }
  } catch (e) {
    return {
      strategy: defaultStrategy(),
      error: e instanceof Error ? e.message : 'Ошибка в коде',
    }
  }
}

function defaultStrategy(): Strategy {
  return { primary: 'attack', lowHp: 'heavy', onHit: 'dodge', style: 'Standard', position: 'mid' }
}

export function runCodeToStrategy(code: string): { strategy: Strategy; error?: string } {
  if (!code.trim()) return { strategy: defaultStrategy(), error: 'Код не написан' }
  if (hasDynamicStrategy(code)) return buildDynamicStrategy(code)
  return buildStaticStrategy(code)
}
