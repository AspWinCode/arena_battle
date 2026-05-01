import type { Strategy, StrategyContext } from '@robocode/shared'
import { buildStrategy, type ActionCall } from './build-strategy.js'

const ACTION_NAMES = [
  'attack',
  'heavy',
  'laser',
  'shield',
  'dodge',
  'repair',
  'special',
  'moveForward',
  'moveBackward',
] as const

export const ACTION_BRIDGE_SOURCE = ACTION_NAMES.map(name => `
globalThis.${name} = (...args) => {
  const ref = globalThis.__bridge_${name};
  ref.applySync(undefined, args, { arguments: { copy: true } });
  return '${name}';
};
`).join('\n')

/** Check if user code defines a strategy(ctx) function */
function hasDynamicStrategy(code: string): boolean {
  return /function\s+strategy\s*\(/.test(code)
    || /(?:const|let|var)\s+strategy\s*=\s*(?:function|\(|ctx\s*=>)/.test(code)
}

// ── Dynamic strategy: strategy(ctx) function executed per-turn ───────────────

async function buildDynamicStrategy(code: string): Promise<Strategy> {
  let ivm: typeof import('isolated-vm') | null = null
  try {
    ivm = await import('isolated-vm')
  } catch {
    console.warn('[sandbox] isolated-vm not available, using fallback')
    return buildStrategy([])
  }

  const Isolate = (ivm as any).Isolate ?? (ivm as any).default?.Isolate
  if (!Isolate) return buildStrategy([])

  const isolate = new Isolate({ memoryLimit: 32 })
  const vmCtx = await isolate.createContext()

  try {
    // Compile user code so `strategy` function is defined in the context
    const script = await isolate.compileScript(code)
    await script.run(vmCtx, { timeout: 100 })

    // Verify the strategy function exists and is callable
    const strategyRef = await vmCtx.global.get('strategy', { reference: true })
    if (!strategyRef || strategyRef.typeof !== 'function') {
      isolate.dispose()
      return buildStrategy([])
    }

    const VALID = new Set(['attack', 'laser', 'shield', 'dodge', 'combo', 'repair'])

    // Build the fn closure — captures the isolate and ref
    const fn = (ctx: StrategyContext): import('@robocode/shared').ActionName => {
      try {
        // isolated-vm requires serializable args; StrategyContext is a plain object
        const result = strategyRef.applySync(undefined, [ctx], {
          arguments: { copy: true },
          result:    { copy: true },
          timeout: 10,
        })
        if (typeof result === 'string' && VALID.has(result)) {
          return result as import('@robocode/shared').ActionName
        }
      } catch {
        // user code errored — engine will fall back
      }
      return 'attack'
    }

    // Also run a test to derive static fallbacks
    const testCalls: ActionCall[] = []
    const makeBridge = (n: string) => new (
      (ivm as any).Reference ?? (ivm as any).default?.Reference
    )((...args: unknown[]) => { testCalls.push({ action: n }) })

    for (const n of ACTION_NAMES) {
      await vmCtx.global.set(`__bridge_${n}`, makeBridge(n))
    }

    // Run test scenarios to fill static fallbacks (used if fn throws on turn 1)
    const testScript = await isolate.compileScript(`
      ;(function(){
        var cd = {attack:0,heavy:0,laser:0,shield:0,dodge:0,repair:0,special:0};
        var e1 = { myHp:80, myStamina:100, myRage:0, enemyHp:60, enemyStamina:100, enemyRage:0,
          turn:1, myLastAction:null, enemyLastAction:null, cooldowns:cd,
          myPosition:'mid', enemyPosition:'mid', myRepeatCount:0 };
        var e2 = { myHp:20, myStamina:30, myRage:80, enemyHp:70, enemyStamina:60, enemyRage:20,
          turn:8, myLastAction:'attack', enemyLastAction:'heavy', cooldowns:cd,
          myPosition:'close', enemyPosition:'close', myRepeatCount:2 };
        if (typeof strategy === 'function') { strategy(e1); strategy(e2); }
      })();
    `)
    await testScript.run(vmCtx, { timeout: 50 }).catch(() => {})

    const base = buildStrategy(testCalls)
    base.fn = fn

    // Don't dispose isolate here — fn closure needs it alive
    // It will be GC'd when the session ends and `fn` is no longer referenced
    return base

  } catch (err) {
    console.warn('[sandbox] dynamic strategy build error:', err)
    isolate.dispose()
    return buildStrategy([])
  }
}

// ── Static strategy: legacy onRoundStart(enemy) call pattern ────────────────

const TEST_CODE_SUFFIX = `
;(function(){
  var e1 = { hp:60, stamina:100, rage:0, lastAction:'attack', shieldActive:false,
    cooldowns:{attack:0,heavy:0,laser:0,shield:0,dodge:0,repair:0,special:0} };
  var e2 = { hp:20, stamina:30,  rage:80, lastAction:'heavy', shieldActive:false,
    cooldowns:{attack:0,heavy:0,laser:0,shield:0,dodge:0,repair:0,special:0} };
  if (typeof onRoundStart === 'function') { onRoundStart(e1); onRoundStart(e2); }
  if (typeof on_round_start === 'function') { on_round_start(e1); on_round_start(e2); }
})();
`

async function buildStaticStrategy(code: string): Promise<Strategy> {
  let ivm: typeof import('isolated-vm') | null = null
  try {
    ivm = await import('isolated-vm')
  } catch {
    console.warn('[sandbox] isolated-vm not available, using fallback strategy')
    return buildStrategy([])
  }

  const Isolate  = (ivm as any).Isolate  ?? (ivm as any).default?.Isolate
  const Reference = (ivm as any).Reference ?? (ivm as any).default?.Reference
  if (!Isolate) return buildStrategy([])

  const isolate = new Isolate({ memoryLimit: 32 })
  const ctx = await isolate.createContext()
  const results: ActionCall[] = []

  const makeRef = (action: string) =>
    new Reference((...args: unknown[]) => {
      const extra: Record<string, unknown> = {}
      if (typeof args[0] === 'string') extra.type = args[0]
      else if (typeof args[0] === 'number') extra.power = args[0]
      results.push({ action, ...extra })
    })

  for (const actionName of ACTION_NAMES) {
    await ctx.global.set(`__bridge_${actionName}`, makeRef(actionName))
  }

  try {
    const fullCode = `${ACTION_BRIDGE_SOURCE}\n${code}\n${TEST_CODE_SUFFIX}`
    const script = await isolate.compileScript(fullCode)
    await script.run(ctx, { timeout: 50 })
  } catch (err) {
    console.warn('[sandbox] JS execution error:', err)
  } finally {
    isolate.dispose()
  }

  return buildStrategy(results)
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runJS(code: string): Promise<Strategy> {
  if (hasDynamicStrategy(code)) {
    return buildDynamicStrategy(code)
  }
  return buildStaticStrategy(code)
}
