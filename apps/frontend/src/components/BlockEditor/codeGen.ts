import type { BlockInstance, Script, SlotValue } from './types'
import { BLOCK_DEF_MAP } from './blockDefs'

export function generateCode(root: BlockInstance | null): string {
  if (!root) return ''
  return generateCodeFromScripts([{ id: '__root__', root }])
}

export function generateCodeFromScripts(scripts: Script[]): string {
  if (scripts.length === 0) return 'function strategy(ctx) {\n  return \'attack\'; // нет блоков\n}'

  // Only process scripts that start with a whenTurn hat — floating blocks are ignored
  const hatRoots = scripts
    .map(script => script.root)
    .filter(root => root?.defId === 'whenTurn')
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))

  if (hatRoots.length === 0) return 'function strategy(ctx) {\n  return \'attack\'; // нет блоков\n}'

  const lines: string[] = []
  lines.push('function strategy(ctx) {')

  const varNames = new Set<string>()
  for (const root of hatRoots) {
    collectVarNames(root.next ?? null, varNames)
  }
  if (varNames.size > 0) {
    lines.push(`  let ${[...varNames].map(v => `${v} = 0`).join(', ')};`)
  }

  for (const root of hatRoots) {
    lines.push(...generateBlock(root.next ?? null, 1))
  }

  lines.push("  return 'attack'; // fallback")
  lines.push('}')
  return lines.join('\n')
}

function indent(n: number) {
  return '  '.repeat(n)
}

function sanitizeVarName(name: string): string {
  if (!name.trim()) return '__var'
  return name.trim().replace(/^(\d)/, '_$1').replace(/[^\wЀ-ӿ]/g, '_')
}


function collectVarNames(inst: BlockInstance | null, acc: Set<string> = new Set()): Set<string> {
  if (!inst) return acc
  if (inst.defId === 'setVar' || inst.defId === 'changeVar') {
    const slot = inst.slots.find(s => s.slotId === 'name')
    if (slot?.value && typeof slot.value === 'string' && slot.value.trim()) {
      acc.add(sanitizeVarName(slot.value))
    }
  }
  for (const slot of inst.slots) {
    if (slot.value && typeof slot.value === 'object' && 'instanceId' in slot.value) {
      collectVarNames(slot.value as BlockInstance, acc)
    }
  }
  if (inst.next) collectVarNames(inst.next, acc)
  inst.body?.forEach(b => collectVarNames(b, acc))
  inst.elseBody?.forEach(b => collectVarNames(b, acc))
  return acc
}

function slotValue(sv: SlotValue | undefined): string {
  if (!sv) return '0'
  const v = sv.value
  if (v === null || v === undefined) return '0'
  if (typeof v === 'object' && 'instanceId' in v) {
    return generateExpression(v as BlockInstance)
  }
  return JSON.stringify(v)
}

/** Returns true only when a real block is plugged into the slot (not just a primitive/empty) */
function slotHasBlock(inst: BlockInstance, slotId: string): boolean {
  const sv = inst.slots.find(s => s.slotId === slotId)
  return !!(sv?.value && typeof sv.value === 'object' && 'instanceId' in sv.value)
}

function generateExpression(inst: BlockInstance): string {
  const s = (id: string) => slotValue(inst.slots.find(sv => sv.slotId === id))

  switch (inst.defId) {
    case 'ctxMyHp':            return 'ctx.myHp'
    case 'ctxEnemyHp':         return 'ctx.enemyHp'
    case 'ctxMyRage':          return 'ctx.myRage'
    case 'ctxEnemyRage':       return 'ctx.enemyRage'
    case 'ctxMyStamina':       return 'ctx.myStamina'
    case 'ctxEnemyStamina':    return 'ctx.enemyStamina'
    case 'ctxMyLastAction':    return 'ctx.myLastAction'
    case 'ctxEnemyLastAction': return 'ctx.enemyLastAction'
    case 'ctxMyPosition':      return 'ctx.myPosition'
    case 'ctxEnemyPosition':   return 'ctx.enemyPosition'
    case 'ctxCooldownLaser':   return 'ctx.cooldowns.laser'
    case 'ctxCooldownHeavy':   return 'ctx.cooldowns.heavy'
    case 'ctxTurn':            return 'ctx.turn'
    case 'ctxRepeatCount':     return 'ctx.myRepeatCount'
    case 'ctxEnemyHasShield':  return "(ctx.enemyLastAction === 'shield')"
    case 'ctxMyHasShield':     return "(ctx.myLastAction === 'shield')"
    case 'percentChance':      return `(Math.random() * 100 < ${s('pct')})`
    // Level 2 — history
    case 'ctxEnemyHistoryCount': {
      const action = inst.slots.find(sv => sv.slotId === 'action')?.value ?? 'attack'
      return `(ctx.enemyHistory ?? []).filter(a => a === ${JSON.stringify(action)}).length`
    }
    case 'ctxMyHistoryCount': {
      const action = inst.slots.find(sv => sv.slotId === 'action')?.value ?? 'attack'
      return `(ctx.myHistory ?? []).filter(a => a === ${JSON.stringify(action)}).length`
    }
    case 'ctxDamageLast':      return `((ctx.damageLog ?? [])[ctx.damageLog.length - 1] ?? 0)`
    case 'ctxDamageTakenLast': return `((ctx.damageTakenLog ?? [])[ctx.damageTakenLog.length - 1] ?? 0)`
    // Level 3 — patterns
    case 'ctxEnemyFreqMost':
      return `(Object.keys(ctx.enemyFrequency ?? {}).reduce((a,b) => (ctx.enemyFrequency[a]??0) > (ctx.enemyFrequency[b]??0) ? a : b, 'attack'))`
    case 'ctxEnemyPhase':      return `ctx.enemyPhase`
    case 'ctxEnemyTrend':      return `ctx.enemyTrend`
    case 'ctxEnemyFreqCount': {
      const action = inst.slots.find(sv => sv.slotId === 'action')?.value ?? 'attack'
      return `((ctx.enemyFrequency ?? {})[${JSON.stringify(action)}] ?? 0)`
    }
    case 'ctxIsEnemyPhase': {
      const phase = inst.slots.find(sv => sv.slotId === 'phase')?.value ?? 'late'
      return `(ctx.enemyPhase === ${JSON.stringify(phase)})`
    }
    case 'ctxIsEnemyTrend': {
      const trend = inst.slots.find(sv => sv.slotId === 'trend')?.value ?? 'aggressive'
      return `(ctx.enemyTrend === ${JSON.stringify(trend)})`
    }
    // Cooldowns for new actions
    case 'ctxCooldownCombo':     return `(ctx.cooldowns?.combo ?? 0)`
    case 'ctxCooldownTrap':      return `(ctx.cooldowns?.trap ?? 0)`
    case 'ctxCooldownReflect':   return `(ctx.cooldowns?.reflect ?? 0)`
    case 'ctxCooldownSacrifice': return `(ctx.cooldowns?.sacrifice ?? 0)`
    case 'ctxCooldownReboot':    return `(ctx.cooldowns?.reboot ?? 0)`
    case 'ctxCooldownHack':      return `(ctx.cooldowns?.hack ?? 0)`
    case 'ctxCooldownAnalyze':   return `(ctx.cooldowns?.analyze ?? 0)`
    case 'enemyHp':            return 'ctx.enemyHp'
    case 'myHp':               return 'ctx.myHp'
    case 'enemyLastAction':    return 'ctx.enemyLastAction'
    case 'enemyHasShield':     return "(ctx.enemyLastAction === 'shield')"
    case 'roundNumber':        return 'ctx.turn'
    case 'greaterThan': return `(${s('a')} > ${s('b')})`
    case 'lessThan':    return `(${s('a')} < ${s('b')})`
    case 'geq':         return `(${s('a')} >= ${s('b')})`
    case 'leq':         return `(${s('a')} <= ${s('b')})`
    case 'equals':      return `(${s('a')} === ${s('b')})`
    case 'notEquals':   return `(${s('a')} !== ${s('b')})`
    case 'and': {
      const a = slotHasBlock(inst, 'a') ? s('a') : 'false'
      const b = slotHasBlock(inst, 'b') ? s('b') : 'false'
      return `(${a} && ${b})`
    }
    case 'or': {
      const a = slotHasBlock(inst, 'a') ? s('a') : 'false'
      const b = slotHasBlock(inst, 'b') ? s('b') : 'false'
      return `(${a} || ${b})`
    }
    case 'not': {
      const a = slotHasBlock(inst, 'a') ? s('a') : 'false'
      return `!(${a})`
    }
    case 'varReporter': {
      const name = inst.slots.find(sv => sv.slotId === 'name')?.value
      return name && typeof name === 'string' ? sanitizeVarName(name) : '__var'
    }
    default: return '0'
  }
}

const RETURNING_BLOCK_IDS = new Set([
  'doAttack','doHeavy','doLaser','doShield','doDodge','doRepair','doSpecial','doRandom',
  'doCombo','doOvercharge','doReflect','doAdaptiveShield','doTrap','doHack',
  'doSacrifice','doReboot','doTransfer','doAnalyze','doOverclock','stop',
])

function generateBlock(inst: BlockInstance | null, depth: number): string[] {
  if (!inst) return []

  const def = BLOCK_DEF_MAP.get(inst.defId)
  if (!def) return generateBlock(inst.next ?? null, depth)

  const ind = indent(depth)
  const lines: string[] = []
  const s = (id: string) => slotValue(inst.slots.find(sv => sv.slotId === id))

  switch (inst.defId) {
    case 'doAttack':  lines.push(`${ind}return 'attack';`);          break
    case 'doHeavy':   lines.push(`${ind}return 'heavy';`);           break
    case 'doLaser':   lines.push(`${ind}return 'laser';`);           break
    case 'doShield':  lines.push(`${ind}return 'shield';`);          break
    case 'doDodge':   lines.push(`${ind}return 'dodge';`);           break
    case 'doRepair':  lines.push(`${ind}return 'repair';`);          break
    case 'doSpecial': lines.push(`${ind}return 'special';`);         break
    case 'doRandom':  lines.push(`${ind}return ['attack','heavy','laser','shield','dodge','repair','special'][Math.floor(Math.random()*7)];`); break
    case 'doCombo':          lines.push(`${ind}return 'combo';`);           break
    case 'doOvercharge':     lines.push(`${ind}return 'overcharge';`);      break
    case 'doReflect':        lines.push(`${ind}return 'reflect';`);         break
    case 'doAdaptiveShield': lines.push(`${ind}return 'adaptive_shield';`); break
    case 'doTrap':           lines.push(`${ind}return 'trap';`);            break
    case 'doHack':           lines.push(`${ind}return 'hack';`);            break
    case 'doSacrifice':      lines.push(`${ind}return 'sacrifice';`);       break
    case 'doReboot':         lines.push(`${ind}return 'reboot';`);          break
    case 'doTransfer':       lines.push(`${ind}return 'transfer';`);        break
    case 'doAnalyze':        lines.push(`${ind}return 'analyze';`);         break
    case 'doOverclock':      lines.push(`${ind}return 'overclock';`);       break
    case 'whenTurn': break
    case 'stop':     lines.push(`${ind}return 'attack';`); break
    case 'moveForward': break
    case 'moveBackward': break
    case 'setVar': {
      const name = inst.slots.find(sv => sv.slotId === 'name')?.value
      const varName = name && typeof name === 'string' ? sanitizeVarName(name) : '__var'
      lines.push(`${ind}${varName} = ${s('value')};`)
      break
    }
    case 'changeVar': {
      const name = inst.slots.find(sv => sv.slotId === 'name')?.value
      const varName = name && typeof name === 'string' ? sanitizeVarName(name) : '__var'
      lines.push(`${ind}${varName} += ${s('by')};`)
      break
    }
    case 'if': {
      if (!slotHasBlock(inst, 'cond')) {
        lines.push(...generateBlocks(inst.body ?? [], depth))
        break
      }
      lines.push(`${ind}if (${s('cond')}) {`)
      lines.push(...generateBlocks(inst.body ?? [], depth + 1))
      lines.push(`${ind}}`)
      break
    }
    case 'ifElse': {
      if (!slotHasBlock(inst, 'cond')) {
        lines.push(...generateBlocks(inst.body ?? [], depth))
        lines.push(...generateBlocks(inst.elseBody ?? [], depth))
        break
      }
      lines.push(`${ind}if (${s('cond')}) {`)
      lines.push(...generateBlocks(inst.body ?? [], depth + 1))
      lines.push(`${ind}} else {`)
      lines.push(...generateBlocks(inst.elseBody ?? [], depth + 1))
      lines.push(`${ind}}`)
      break
    }
    case 'repeat': {
      const count = slotHasBlock(inst, 'n') ? s('n') : (s('n') === '0' ? '3' : s('n'))
      lines.push(`${ind}for (let _i = 0; _i < ${count}; _i++) {`)
      lines.push(...generateBlocks(inst.body ?? [], depth + 1))
      lines.push(`${ind}}`)
      break
    }
    case 'forever': {
      lines.push(`${ind}for (let _loop = 0; _loop < 100; _loop++) {`)
      lines.push(...generateBlocks(inst.body ?? [], depth + 1))
      lines.push(`${ind}}`)
      break
    }
  }

  // Warn in generated code if this block always returns but has chained successors
  if (RETURNING_BLOCK_IDS.has(inst.defId) && inst.next) {
    lines.push(`${ind}// ⚠ блок выше всегда возвращает результат — код ниже не выполнится`)
  }

  lines.push(...generateBlock(inst.next ?? null, depth))
  return lines
}

function generateBlocks(blocks: BlockInstance[], depth: number): string[] {
  return blocks.flatMap(b => generateBlock(b, depth))
}
