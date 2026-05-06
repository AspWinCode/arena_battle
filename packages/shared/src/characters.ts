import type { SkinId } from './types'

// ─── Character definitions ─────────────────────────────────────────────────────
//
// Every skin maps to a CharacterStats object that the battle engine reads.
// Passives are implemented directly in battle-engine.ts.

export interface CharacterStats {
  /** Max HP at round start (base is 100) */
  maxHp: number
  /** Multiplier applied to all outgoing damage (base is 1.0) */
  dmgMult: number
  /** Multiplier applied to rage gained per damage taken (base is 1.0) */
  rageMult: number
  /** Extra HP from repair action on top of REPAIR_AMOUNT (base is 0) */
  repairBonus: number
  /** Extra shield absorption added to SHIELD_ABSORB (base is 0) */
  shieldBonus: number
  /** Whether this character has the counter-strike passive (Boxer) */
  hasCounter: boolean

  // ── Display ──────────────────────────────────────────────────────────────────
  name: string
  icon: string
  color: string
  /** Short description of the passive for the UI */
  passive: string
  /** One-liner shown under the character name in the picker */
  tagline: string
}

export const CHARACTER_STATS: Record<SkinId, CharacterStats> = {
  robot: {
    maxHp:       100,
    dmgMult:     1.0,
    rageMult:    1.0,
    repairBonus: 0,
    shieldBonus: 0,
    hasCounter:  false,
    name:    'Робот',
    icon:    '🤖',
    color:   '#00e5ff',
    tagline: 'Идеален для начинающих',
    passive: 'Сбалансированный боец без особых способностей. Отличный выбор для обучения механикам игры.',
  },
  gladiator: {
    maxHp:       80,
    dmgMult:     1.35,
    rageMult:    1.5,
    repairBonus: 0,
    shieldBonus: 0,
    hasCounter:  false,
    name:    'Гладиатор',
    icon:    '⚔️',
    color:   '#d97706',
    tagline: 'Высокий урон, мало HP',
    passive: '⚡ Берсерк: ярость накапливается в 1.5× быстрее — чаще активируй спецудар. Рискованный, но смертоносный стиль.',
  },
  boxer: {
    maxHp:       105,
    dmgMult:     1.0,
    rageMult:    1.0,
    repairBonus: 0,
    shieldBonus: 0,
    hasCounter:  true,
    name:    'Боксёр',
    icon:    '🥊',
    color:   '#e6261f',
    tagline: 'Мастер контратак',
    passive: '🥊 Контрудар: уклонился от атаки противника — следующий attack наносит ×2 урон. Один шанс, используй мудро.',
  },
  cosmonaut: {
    maxHp:       120,
    dmgMult:     0.8,
    rageMult:    1.0,
    repairBonus: 15,   // repair heals 35 total
    shieldBonus: 0.1,  // shield absorbs 70% total
    hasCounter:  false,
    name:    'Космонавт',
    icon:    '🚀',
    color:   '#7c3aed',
    tagline: 'Танк с мощной защитой',
    passive: '🛡 Ремонтник: repair восстанавливает 35 HP вместо 20, щит блокирует 70% урона вместо 60%. Низкий урон, но трудно убить.',
  },
}
