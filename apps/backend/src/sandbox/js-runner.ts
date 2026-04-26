import type { Strategy } from '@robocode/shared'
import { buildStrategy, type ActionCall } from './build-strategy.js'

const TEST_CODE_SUFFIX = `
;(function(){
  var e1 = { hp:60, lastAction:'attack', shieldActive:false, cooldowns:{laser:0,combo:0,repair:0} };
  var e2 = { hp:20, lastAction:'laser',  shieldActive:false, cooldowns:{laser:0,combo:0,repair:0} };
  if (typeof onRoundStart === 'function') { onRoundStart(e1); onRoundStart(e2); }
  if (typeof on_round_start === 'function') { on_round_start(e1); on_round_start(e2); }
})();
`

export async function runJS(code: string): Promise<Strategy> {
  // Dynamic import to avoid build errors when isolated-vm is not installed
  let ivm: typeof import('isolated-vm') | null = null
  try {
    ivm = await import('isolated-vm')
  } catch {
    console.warn('[sandbox] isolated-vm not available, using fallback strategy')
    return buildStrategy([])
  }

  const Isolate = (ivm as any).Isolate ?? (ivm as any).default?.Isolate
  if (!Isolate) {
    console.warn('[sandbox] Isolate constructor not found in isolated-vm export')
    return buildStrategy([])
  }

  const Reference = (ivm as any).Reference ?? (ivm as any).default?.Reference
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

  await ctx.global.set('attack',       makeRef('attack'))
  await ctx.global.set('laser',        makeRef('laser'))
  await ctx.global.set('shield',       makeRef('shield'))
  await ctx.global.set('dodge',        makeRef('dodge'))
  await ctx.global.set('combo',        makeRef('combo'))
  await ctx.global.set('repair',       makeRef('repair'))
  await ctx.global.set('moveForward',  makeRef('moveForward'))
  await ctx.global.set('moveBackward', makeRef('moveBackward'))

  try {
    const fullCode = code + TEST_CODE_SUFFIX
    const script = await isolate.compileScript(fullCode)
    await script.run(ctx, { timeout: 50 })
  } catch (err) {
    console.warn('[sandbox] JS execution error:', err)
  } finally {
    isolate.dispose()
  }

  return buildStrategy(results)
}
