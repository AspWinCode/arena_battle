import type { ActionName } from './types'

// ── VFX effect names ───────────────────────────────────────────────────────────
export type VFXType =
  | 'hit_normal'
  | 'hit_crit'
  | 'hit_fire'
  | 'hit_lightning'
  | 'poison_tick'
  | 'heal'
  | 'shield_up'
  | 'rage_gain'
  | 'special_aura'
  | 'ko_impact'

// ── Animation names (what CharacterView/adapters understand) ──────────────────
export type AnimationName =
  | 'idle'
  | 'ready'
  | 'walk_forward'
  | 'walk_backward'
  | 'attack'
  | 'heavy'
  | 'ranged'
  | 'shield'
  | 'dodge'
  | 'hit'
  | 'special'
  | 'ko'
  | 'victory'

// ── Body type / animation profile ─────────────────────────────────────────────
/** Three base rigs — characters of the same profile share animations */
export type AnimationProfile = 'small' | 'medium' | 'heavy'

// ── Action → Animation mapping ────────────────────────────────────────────────
export const ACTION_TO_ANIMATION: Record<ActionName, AnimationName> = {
  attack:          'attack',
  heavy:           'heavy',
  laser:           'ranged',
  shield:          'shield',
  dodge:           'dodge',
  repair:          'idle',       // healing — no movement, VFX only
  special:         'special',
  combo:           'attack',     // fast attack × 2
  overcharge:      'heavy',
  reflect:         'shield',
  adaptive_shield: 'shield',
  trap:            'ranged',
  hack:            'special',
  sacrifice:       'special',
  reboot:          'idle',
  transfer:        'idle',
  analyze:         'idle',
  overclock:       'idle',
}

// ── Battle event log (visual layer reads this; engine only writes it) ─────────
export type BattleActor = 'p1' | 'p2'

export type BattleEvent =
  | { actor: BattleActor; type: 'move';    to: 'close' | 'mid' | 'far' }
  | { actor: BattleActor; type: 'action';  action: ActionName }
  | { actor: BattleActor; type: 'damage';  amount: number; isCrit?: boolean }
  | { actor: BattleActor; type: 'heal';    amount: number }
  | { actor: BattleActor; type: 'vfx';     effect: VFXType }
  | { actor: BattleActor; type: 'status';  status: 'poison' | 'shield' | 'rage' }
  | { actor: BattleActor; type: 'ko' }
  | { actor: BattleActor; type: 'victory' }
