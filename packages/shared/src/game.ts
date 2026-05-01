import type { ActionName, Position } from './types'

// ─── Core constants ───────────────────────────────────────────────────────────

export const MAX_HP      = 100
export const MAX_TURNS   = 20
export const REPAIR_AMOUNT = 20

// ─── Stamina system ───────────────────────────────────────────────────────────

export const MAX_STAMINA = 100

/** Stamina restored at the START of every turn (before action cost) */
export const STAMINA_REGEN = 8

/**
 * Stamina cost per action.
 * Negative = gain (shield/dodge restore stamina instead of spending it).
 */
export const STAMINA_COSTS: Record<ActionName, number> = {
  attack:  10,
  heavy:   35,   // heavy attack — expensive
  laser:   20,
  shield: -20,   // bracing recovers stamina
  dodge:  -10,   // quick sidestep is stamina-neutral+
  repair:  0,    // resting — no stamina cost
  special: 0,    // rage-gated, not stamina-gated
}

/**
 * If attacker's stamina (before cost) is below these thresholds,
 * the action is weakened or fails.
 */
export const STAMINA_THRESHOLD_HEAVY  = 35   // below this: heavy MISSES completely
export const STAMINA_THRESHOLD_ATTACK = 10   // below this: attack deals only ATTACK_EXHAUSTED_DAMAGE
export const STAMINA_THRESHOLD_LASER  = 20   // below this: laser deals half damage
export const ATTACK_EXHAUSTED_DAMAGE  = 2    // "wet-noodle" attack when drained

// ─── Rage system ─────────────────────────────────────────────────────────────

export const MAX_RAGE            = 100
/** Rage gained per point of damage taken */
export const RAGE_PER_DAMAGE     = 0.4
export const SPECIAL_DAMAGE      = 50
export const SPECIAL_RAGE_COST   = 100

// ─── Base damage (before modifiers) ──────────────────────────────────────────

export const BASE_DAMAGE: Partial<Record<ActionName, number>> = {
  attack:  12,
  heavy:   28,
  laser:   20,
  special: 50,
  // shield, dodge, repair = 0
}

// ─── Counter / mitigation ────────────────────────────────────────────────────

/** Fraction of incoming damage BLOCKED by shield (0.6 = 60%) */
export const SHIELD_ABSORB = 0.6

/**
 * Dodge behaviour:
 * - Vs melee (attack, heavy): 100% evade
 * - Vs laser: 50% evade
 * - Vs special: 50% evade (not a full block)
 */
export const DODGE_LASER_EVADE_CHANCE   = 0.5
export const DODGE_SPECIAL_ABSORB       = 0.5

// ─── Repeat penalty ──────────────────────────────────────────────────────────

export const REPEAT_PENALTY_AFTER  = 3
export const REPEAT_DAMAGE_FACTOR  = 0.5

// ─── Cooldowns ───────────────────────────────────────────────────────────────

export const COOLDOWNS: Record<ActionName, number> = {
  attack:  0,
  heavy:   4,
  laser:   3,
  shield:  2,
  dodge:   1,
  repair:  3,
  special: 0,  // rage-gated; no cooldown once rage refills
}

// ─── Position modifiers (Phase 1 v2) ─────────────────────────────────────────
//
//  action   CLOSE   MID   FAR
//  attack   ×1.3   ×1.0  ×0.6
//  heavy    ×1.5   ×1.0  ×0.3  (still MISSES if stamina < 35)
//  laser    ×0.7   ×1.0  ×1.4

const POSITION_MULTIPLIERS: Partial<Record<ActionName, Record<Position, number>>> = {
  attack: { close: 1.3, mid: 1.0, far: 0.6 },
  heavy:  { close: 1.5, mid: 1.0, far: 0.3 },
  laser:  { close: 0.7, mid: 1.0, far: 1.4 },
}

export function getPositionMultiplier(action: ActionName, position: Position): number {
  return POSITION_MULTIPLIERS[action]?.[position] ?? 1.0
}

export function applyPositionModifier(
  action: ActionName,
  position: Position,
  baseDmg: number,
): number {
  const m = getPositionMultiplier(action, position)
  return m === 1.0 ? baseDmg : Math.floor(baseDmg * m)
}

// ─── Block editor metadata ────────────────────────────────────────────────────

export const BLOCK_CATEGORIES = [
  {
    id: 'combat',
    label: '⚔️ Combat',
    color: '#e6261f',
    blocks: ['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special', 'moveForward', 'moveBackward'],
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
    blocks: [
      'enemyHp', 'enemyLastAction', 'enemyHasShield',
      'myStamina', 'enemyStamina', 'myRage', 'enemyRage',
      'heavyCooldown', 'laserCooldown', 'repairCooldown',
      'atCloseRange', 'atFarRange', 'roundNumber', 'damageReceived',
    ],
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
