import type { BlockInstance, SlotValue } from './types'
import { BLOCK_DEF_MAP } from './blockDefs'

export function generateCode(root: BlockInstance | null): string {
  if (!root) return ''

  const lines: string[] = []
  lines.push('function strategy(ctx) {')

  // Declare all variables used in the script
  const varNames = collectVarNames(root.next ?? null)
  if (varNames.size > 0) {
    lines.push(`  let ${[...varNames].map(v => `${v} = 0`).join(', ')};`)
  }

  lines.push(...generateBlock(root.next ?? null, 1))
  lines.push('  return \'attack\'; // fallback')
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
  if (inst.next) collectVarNames(inst.next, acc)
  inst.body?.forEach(b => collectVarNames(b, acc))
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

function generateExpression(inst: BlockInstance): string {
  const s = (id: string) => slotValue(inst.slots.find(sv => sv.slotId === id))

  switch (inst.defId) {
    // Sensing reporters → ctx fields
    case 'ctxMyHp':            return 'ctx.myHp'
    case 'ctxEnemyHp':         return 'ctx.enemyHp'
    case 'ctxMyRage':          return 'ctx.myRage'
    case 'ctxMyStamina':       return 'ctx.myStamina'
    case 'ctxMyLastAction':    return 'ctx.myLastAction'
    case 'ctxEnemyLastAction': return 'ctx.enemyLastAction'
    case 'ctxCooldownLaser':   return 'ctx.cooldowns.laser'
    case 'ctxCooldownHeavy':   return 'ctx.cooldowns.heavy'
    case 'ctxTurn':            return 'ctx.turn'
    case 'ctxRepeatCount':     return 'ctx.myRepeatCount'
    case 'ctxEnemyHasShield':  return "(ctx.enemyLastAction === 'shield')"
    // Legacy IDs (backwards compat)
    case 'enemyHp':            return 'ctx.enemyHp'
    case 'myHp':               return 'ctx.myHp'
    case 'enemyLastAction':    return 'ctx.enemyLastAction'
    case 'enemyHasShield':     return "(ctx.enemyLastAction === 'shield')"
    case 'roundNumber':        return 'ctx.turn'
    // Operators
    case 'greaterThan': return `(${s('a')} > ${s('b')})`
    case 'lessThan':    return `(${s('a')} < ${s('b')})`
    case 'geq':         return `(${s('a')} >= ${s('b')})`
    case 'equals':      return `(${s('a')} === ${s('b')})`
    case 'and':         return `(${s('a')} && ${s('b')})`
    case 'or':          return `(${s('a')} || ${s('b')})`
    case 'not':         return `!(${s('a')})`
    case 'varReporter': {
      const name = inst.slots.find(sv => sv.slotId === 'name')?.value
      return name && typeof name === 'string' ? sanitizeVarName(name) : '__var'
    }
    default: return '0'
  }
}

function generateBlock(inst: BlockInstance | null, depth: number): string[] {
  if (!inst) return []

  const def = BLOCK_DEF_MAP.get(inst.defId)
  if (!def) return generateBlock(inst.next ?? null, depth)

  const ind = indent(depth)
  const lines: string[] = []
  const s = (id: string) => slotValue(inst.slots.find(sv => sv.slotId === id))

  switch (inst.defId) {
    // Combat action blocks — return the action string directly
    case 'doAttack':  lines.push(`${ind}return 'attack';`);  break
    case 'doHeavy':   lines.push(`${ind}return 'heavy';`);   break
    case 'doLaser':   lines.push(`${ind}return 'laser';`);   break
    case 'doShield':  lines.push(`${ind}return 'shield';`);  break
    case 'doDodge':   lines.push(`${ind}return 'dodge';`);   break
    case 'doRepair':  lines.push(`${ind}return 'repair';`);  break
    case 'doSpecial': lines.push(`${ind}return 'special';`); break
    // Hat / cap
    case 'whenTurn': break
    case 'stop':     lines.push(`${ind}return 'attack';`); break  // safe fallback
    // Legacy combat IDs
    case 'attack':      lines.push(`${ind}return 'attack';`);  break
    case 'laser':       lines.push(`${ind}return 'laser';`);   break
    case 'shield':      lines.push(`${ind}return 'shield';`);  break
    case 'dodge':       lines.push(`${ind}return 'dodge';`);   break
    case 'combo':       lines.push(`${ind}return 'special';`); break
    case 'repair':      lines.push(`${ind}return 'repair';`);  break
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
      lines.push(`${ind}if (${s('cond')}) {`)
      lines.push(...generateBlocks(inst.body ?? [], depth + 1))
      lines.push(`${ind}}`)
      break
    }
    case 'ifElse': {
      const half = Math.floor((inst.body ?? []).length / 2)
      lines.push(`${ind}if (${s('cond')}) {`)
      lines.push(...generateBlocks((inst.body ?? []).slice(0, half), depth + 1))
      lines.push(`${ind}} else {`)
      lines.push(...generateBlocks((inst.body ?? []).slice(half), depth + 1))
      lines.push(`${ind}}`)
      break
    }
    case 'repeat': {
      lines.push(`${ind}for (let _i = 0; _i < ${s('n')}; _i++) {`)
      lines.push(...generateBlocks(inst.body ?? [], depth + 1))
      lines.push(`${ind}}`)
      break
    }
    case 'forever': {
      lines.push(`${ind}while (true) {`)
      lines.push(...generateBlocks(inst.body ?? [], depth + 1))
      lines.push(`${ind}}`)
      break
    }
  }

  lines.push(...generateBlock(inst.next ?? null, depth))
  return lines
}

function generateBlocks(blocks: BlockInstance[], depth: number): string[] {
  return blocks.flatMap(b => generateBlock(b, depth))
}
