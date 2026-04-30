import type { BlockInstance, SlotValue } from './types'
import { BLOCK_DEF_MAP } from './blockDefs'

export function generateCode(root: BlockInstance | null): string {
  if (!root) return ''

  const lines: string[] = []
  lines.push('function onRoundStart(enemy) {')

  // Declare all variables used in the script
  const varNames = collectVarNames(root.next ?? null)
  if (varNames.size > 0) {
    lines.push(`  let ${[...varNames].map(v => `${v} = 0`).join(', ')};`)
  }

  lines.push(...generateBlock(root.next ?? null, 1))
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
  const s = (id: string) => slotValue(inst.slots.find(s => s.slotId === id))

  switch (inst.defId) {
    case 'enemyHp':         return 'enemy.hp'
    case 'myHp':            return 'myHp'
    case 'enemyLastAction': return 'enemy.lastAction'
    case 'enemyHasShield':  return 'enemy.shieldActive'
    case 'roundNumber':     return 'roundNumber'
    case 'greaterThan':     return `(${s('a')} > ${s('b')})`
    case 'lessThan':        return `(${s('a')} < ${s('b')})`
    case 'equals':          return `(${s('a')} === ${s('b')})`
    case 'and':             return `(${s('a')} && ${s('b')})`
    case 'or':              return `(${s('a')} || ${s('b')})`
    case 'not':             return `!(${s('a')})`
    case 'varReporter': {
      const name = inst.slots.find(s => s.slotId === 'name')?.value
      return name && typeof name === 'string' ? sanitizeVarName(name) : '__var'
    }
    default:                return '0'
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
    case 'attack':
      lines.push(`${ind}return attack(${s('type')});`)
      break
    case 'laser':
      lines.push(`${ind}return laser(${s('power')});`)
      break
    case 'shield':
      lines.push(`${ind}return shield(${s('dur')});`)
      break
    case 'dodge':
      lines.push(`${ind}return dodge(${s('dir')});`)
      break
    case 'combo':
      lines.push(`${ind}return combo();`)
      break
    case 'repair':
      lines.push(`${ind}return repair(${s('amt')});`)
      break
    case 'moveForward':
      lines.push(`${ind}moveForward(${s('n')});`)
      break
    case 'moveBackward':
      lines.push(`${ind}moveBackward(${s('n')});`)
      break
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
    case 'stop':
      lines.push(`${ind}return;`)
      break
    case 'whenRoundStarts':
    case 'whenHit':
      break
  }

  lines.push(...generateBlock(inst.next ?? null, depth))
  return lines
}

function generateBlocks(blocks: BlockInstance[], depth: number): string[] {
  return blocks.flatMap(b => generateBlock(b, depth))
}
