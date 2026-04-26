import type { ActionName, Position } from './types'

// ─── Damage Matrix ────────────────────────────────────────────────────────────
// Format: [damageToAttacker, damageToDefender]
// Rows = attacker action, Columns = defender action

export type DamageEntry = {
  atkDmg: number
  defDmg: number
  missChance?: number
  note?: string
}

type DamageRow = Record<ActionName, DamageEntry>
type DamageMatrix = Record<ActionName, DamageRow>

export const DAMAGE_MATRIX: DamageMatrix = {
  attack: {
    attack:  { atkDmg: 15, defDmg: 15 },
    laser:   { atkDmg: 15, defDmg: 15 },
    shield:  { atkDmg:  8, defDmg:  0 },
    dodge:   { atkDmg:  0, defDmg:  0 },
    combo:   { atkDmg: 10, defDmg: 22 },
    repair:  { atkDmg:  0, defDmg: 20 },
  },
  laser: {
    attack:  { atkDmg:  0, defDmg: 25 },
    laser:   { atkDmg: 25, defDmg: 25 },
    shield:  { atkDmg:  0, defDmg: 20 },
    dodge:   { atkDmg:  0, defDmg:  0, missChance: 0.5 },
    combo:   { atkDmg:  5, defDmg: 25 },
    repair:  { atkDmg:  0, defDmg: 30 },
  },
  shield: {
    attack:  { atkDmg:  8, defDmg:  0 },
    laser:   { atkDmg:  0, defDmg: 20 },
    shield:  { atkDmg:  0, defDmg:  0 },
    dodge:   { atkDmg:  0, defDmg:  0 },
    combo:   { atkDmg:  0, defDmg: 10 },
    repair:  { atkDmg:  0, defDmg:  0 },
  },
  dodge: {
    attack:  { atkDmg:  0, defDmg:  0 },
    laser:   { atkDmg:  0, defDmg:  0 },
    shield:  { atkDmg:  0, defDmg:  0 },
    dodge:   { atkDmg:  0, defDmg:  0, missChance: 0.5 },
    combo:   { atkDmg:  0, defDmg: 12 },
    repair:  { atkDmg:  0, defDmg:  0 },
  },
  combo: {
    attack:  { atkDmg: 22, defDmg: 10 },
    laser:   { atkDmg: 25, defDmg:  5 },
    shield:  { atkDmg:  0, defDmg: 10 },
    dodge:   { atkDmg: 12, defDmg:  0 },
    combo:   { atkDmg: 20, defDmg: 20 },
    repair:  { atkDmg:  0, defDmg: 25 },
  },
  repair: {
    attack:  { atkDmg: 20, defDmg:  0 },
    laser:   { atkDmg: 30, defDmg:  0 },
    shield:  { atkDmg:  0, defDmg:  0 },
    dodge:   { atkDmg:  0, defDmg:  0 },
    combo:   { atkDmg: 25, defDmg:  0 },
    repair:  { atkDmg:  0, defDmg:  0 },
  },
}

export const REPAIR_AMOUNT = 20

export const COOLDOWNS: Record<ActionName, number> = {
  attack: 0,
  laser:  3,
  shield: 2,
  dodge:  1,
  combo:  4,
  repair: 3,
}

export const MAX_HP = 100
export const MAX_TURNS = 20

// Positional modifiers
export function applyPositionModifier(
  action: ActionName,
  position: Position,
  baseDmg: number
): number {
  if (action === 'combo' && position === 'close') return Math.floor(baseDmg * 1.2)
  if (action === 'laser' && position === 'far')  return Math.floor(baseDmg * 1.15)
  if (action === 'attack' && position === 'far') return 0 // auto miss
  return baseDmg
}

export const BLOCK_CATEGORIES = [
  {
    id: 'combat',
    label: '⚔️ Combat',
    color: '#e6261f',
    blocks: ['attack', 'laser', 'shield', 'dodge', 'combo', 'repair', 'moveForward', 'moveBackward'],
  },
  {
    id: 'control',
    label: '🔁 Control',
    color: '#ffab19',
    blocks: ['whenClicked', 'whenHit', 'whenRoundStarts', 'if', 'ifElse', 'repeat', 'forever', 'wait', 'stop'],
  },
  {
    id: 'motion',
    label: '🏃 Motion',
    color: '#4c97ff',
    blocks: ['position', 'myHp', 'distanceToEnemy', 'gotoRange'],
  },
  {
    id: 'sensing',
    label: '👁 Sensing',
    color: '#5cb1d6',
    blocks: ['enemyHp', 'enemyLastAction', 'enemyHasShield', 'laserCooldown', 'comboCooldown', 'repairCooldown', 'atCloseRange', 'atFarRange', 'roundNumber', 'damageReceived'],
  },
  {
    id: 'operators',
    label: '➕ Operators',
    color: '#59c059',
    blocks: ['greaterThan', 'lessThan', 'equals', 'and', 'or', 'not', 'add', 'subtract', 'random'],
  },
  {
    id: 'variables',
    label: '📦 Variables',
    color: '#ff8c1a',
    blocks: ['makeVariable', 'setVariable', 'changeVariable'],
  },
] as const
