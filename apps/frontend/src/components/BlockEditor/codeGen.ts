import type { BlockInstance, SlotValue } from './types'
import { BLOCK_DEF_MAP } from './blockDefs'

// Generates JS code from a block script
export function generateCode(root: BlockInstance | null): string {
  if (!root) return ''

  const lines: string[] = []
  lines.push('function onRoundStart(enemy) {')

  const body = generateBlock(root.next ?? null, 1)
  lines.push(...body)

  lines.push('}')
  return lines.join('\n')
}

function indent(n: number) {
  return '  '.repeat(n)
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
  const def = BLOCK_DEF_MAP.get(inst.defId)
  if (!def) return '0'

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
    case 'if': {
      const cond = s('cond')
      lines.push(`${ind}if (${cond}) {`)
      lines.push(...generateBlocks(inst.body ?? [], depth + 1))
      lines.push(`${ind}}`)
      break
    }
    case 'ifElse': {
      const cond = s('cond')
      const half = Math.floor((inst.body ?? []).length / 2)
      lines.push(`${ind}if (${cond}) {`)
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
      // hat blocks — skip, just continue to next
      break
  }

  lines.push(...generateBlock(inst.next ?? null, depth))
  return lines
}

function generateBlocks(blocks: BlockInstance[], depth: number): string[] {
  return blocks.flatMap(b => generateBlock(b, depth))
}
