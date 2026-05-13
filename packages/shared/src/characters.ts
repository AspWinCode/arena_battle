import type { SkinId, ActionName } from './types'

// ─── Character definitions ─────────────────────────────────────────────────────

export interface CharacterStats {
  // ── Base stats ───────────────────────────────────────────────────────────────
  /** Max HP at round start */
  maxHp: number
  /** Global multiplier for ALL outgoing damage */
  dmgMult: number
  /** Multiplier for rage gained per damage TAKEN */
  rageMult: number
  /** Extra HP from repair on top of REPAIR_AMOUNT (Cosmonaut) */
  repairBonus: number
  /** Extra shield absorption added to SHIELD_ABSORB (Cosmonaut) */
  shieldBonus: number

  // ── Unique passives ──────────────────────────────────────────────────────────
  /** Boxer: dodge enemy melee → next attack deals ×2 */
  hasCounter: boolean
  /** Ninja: dodge evades laser & special at 100% instead of default 50% */
  superDodge: boolean
  /** Paladin: HP healed when using shield action */
  shieldHealAmount: number
  /** Vampire: fraction of melee (attack/heavy) damage healed back to attacker */
  lifestealRate: number
  /** Samurai: when HP ÷ maxHp ≤ this threshold, outgoing damage × bushidoMult */
  bushidoThreshold: number
  /** Samurai: damage multiplier when in bushido state */
  bushidoMult: number
  /** Tank: flat HP reduced from every incoming hit (minimum 1 dmg always passes) */
  flatDmgReduction: number
  /** Engineer: rage required to use special (overrides SPECIAL_RAGE_COST=100) */
  specialRageCost: number
  /** Berserker: also gains rage from damage DEALT (in addition to damage taken) */
  rageFromDealt: boolean
  /** Scorpion: opponent's dodge has no effect on attack/heavy ("GET OVER HERE") */
  attackIgnoresDodge: boolean
  /** Plague Doctor: attack/heavy applies this many HP/turn poison damage to enemy */
  poisonOnHit: number
  /** Per-action damage multipliers applied on top of dmgMult (Sniper attack×0.5) */
  actionDmgOverrides: Partial<Record<ActionName, number>>
  /** Cooldown overrides for specific actions (Sniper laser→1, Phantom dodge→0) */
  cooldownOverrides: Partial<Record<ActionName, number>>
  /** Stamina cost overrides for specific actions (Mage laser→0) */
  staminaCostOverrides: Partial<Record<ActionName, number>>

  // ── New Sprint 2 fields ───────────────────────────────────────────────────────
  /** Actions this character is allowed to use */
  allowedActions: ActionName[]
  /** Max overcharge stacks (default 5, Sniper=8) */
  maxChargeStacks: number
  /** Max reboot uses per round (default 1, Paladin=2, Engineer=3) */
  maxRebootUses: number
  /** Sacrifice rage gain bonus (added on top of SACRIFICE_RAGE_GAIN) */
  sacrificeRageBonus: number
  /** Cosmonaut: laser from far = ×2.0 instead of ×1.4 */
  enhancedLaserFar: boolean
  /** Mage: attacks drain extra enemy stamina multiplier */
  staminaDrainMult: number
  /** Ninja: trap also triggers on enemy dodge */
  trapOnDodge: boolean
  /** Combo requires streak of this many attacks (default 3, Boxer=2) */
  comboRequiredStreak: number
  /** Berserker: at HP < this value, all damage ×berserkMult */
  berserkThreshold: number
  /** Berserker: damage multiplier in berserk mode */
  berserkMult: number
  /** Samurai: N consecutive turns without shield/dodge → heavy ×2 */
  bushidoNoDefenseStreak: number

  // ── Display ──────────────────────────────────────────────────────────────────
  name:      string
  icon:      string
  color:     string
  tagline:   string
  passive:   string
  strengths: string[]
  weaknesses: string[]
}

// ─── Default stat block (no passives) ─────────────────────────────────────────

const DEFAULTS: Omit<CharacterStats, 'maxHp' | 'dmgMult' | 'rageMult' | 'name' | 'icon' | 'color' | 'tagline' | 'passive' | 'strengths' | 'weaknesses'> = {
  repairBonus:          0,
  shieldBonus:          0,
  hasCounter:           false,
  superDodge:           false,
  shieldHealAmount:     0,
  lifestealRate:        0,
  bushidoThreshold:     0,
  bushidoMult:          1,
  flatDmgReduction:     0,
  specialRageCost:      100,
  rageFromDealt:        false,
  attackIgnoresDodge:   false,
  poisonOnHit:          0,
  actionDmgOverrides:   {},
  cooldownOverrides:    {},
  staminaCostOverrides: {},
  allowedActions:       [],
  maxChargeStacks:      5,
  maxRebootUses:        1,
  sacrificeRageBonus:   0,
  enhancedLaserFar:     false,
  staminaDrainMult:     0,
  trapOnDodge:          false,
  comboRequiredStreak:  3,
  berserkThreshold:     0,
  berserkMult:          1,
  bushidoNoDefenseStreak: 0,
}

// ─── All 16 characters ────────────────────────────────────────────────────────

export const CHARACTER_STATS: Record<SkinId, CharacterStats> = {

  // ── Original 4 ─────────────────────────────────────────────────────────────

  robot: {
    ...DEFAULTS,
    maxHp: 70, dmgMult: 1.0, rageMult: 1.0,
    allowedActions: ['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'],
    name:    'Робот',
    icon:    '🤖',
    color:   '#00e5ff',
    tagline: 'Идеален для начинающих',
    passive: 'Сбалансированный боец без особых способностей. Отличный выбор для изучения механик.',
    strengths:  ['Универсален, подходит любому стилю', 'Нет критических слабостей'],
    weaknesses: ['Нет уникальных преимуществ', 'Предсказуем для опытных игроков'],
  },

  gladiator: {
    ...DEFAULTS,
    maxHp: 65, dmgMult: 1.35, rageMult: 1.5,
    allowedActions: ['attack', 'heavy', 'combo', 'overcharge', 'special', 'sacrifice'],
    name:    'Гладиатор',
    icon:    '⚔️',
    color:   '#d97706',
    tagline: 'Высокий урон, мало HP',
    passive: '⚡ Берсерк: ярость накапливается в 1.5× быстрее — чаще используй спецудар.',
    strengths:  ['Очень высокий урон', 'Спецудар срабатывает очень часто'],
    weaknesses: ['Мало HP, уязвим к burst', 'Быстро умирает без лечения'],
  },

  boxer: {
    ...DEFAULTS,
    maxHp: 60, dmgMult: 1.0, rageMult: 1.0,
    hasCounter: true,
    comboRequiredStreak: 2,
    allowedActions: ['attack', 'heavy', 'dodge', 'combo', 'special', 'reflect'],
    name:    'Боксёр',
    icon:    '🥊',
    color:   '#e6261f',
    tagline: 'Мастер контратак',
    passive: '🥊 Контрудар: уклонился от атаки — следующий attack наносит ×2 урон.',
    strengths:  ['Контратака удваивает урон', 'Отличен против агрессивных стратегий'],
    weaknesses: ['Требует точного timing dodge', 'Слаб если противник не атакует вблизи'],
  },

  cosmonaut: {
    ...DEFAULTS,
    maxHp: 55, dmgMult: 0.8, rageMult: 1.0,
    repairBonus: 15,
    shieldBonus: 0.1,
    enhancedLaserFar: true,
    allowedActions: ['laser', 'dodge', 'shield', 'overcharge', 'analyze', 'trap'],
    name:    'Космонавт',
    icon:    '🚀',
    color:   '#7c3aed',
    tagline: 'Танк с мощной защитой',
    passive: '🛡 Ремонтник: repair восстанавливает 35 HP вместо 20, щит блокирует 70% урона.',
    strengths:  ['Лучшее лечение в игре (+35 HP)', 'Самый крепкий щит (70% блок)'],
    weaknesses: ['Ниже среднего урон', 'Медленно убивает противника'],
  },

  ninja: {
    ...DEFAULTS,
    maxHp: 50, dmgMult: 0.9, rageMult: 1.0,
    superDodge: true,
    trapOnDodge: true,
    allowedActions: ['attack', 'dodge', 'trap', 'reflect', 'hack', 'special'],
    name:    'Ниндзя',
    icon:    '🥷',
    color:   '#8b5cf6',
    tagline: 'Уклонение от всего',
    passive: '🌑 Тень: dodge уклоняется от laser на 100% и поглощает 80% от special (вместо 50%).',
    strengths:  ['Почти неуязвим к лазеру и спецудару', 'Высочайшая уклончивость'],
    weaknesses: ['Мало HP', 'Беспомощен без активного dodge'],
  },

  mage: {
    ...DEFAULTS,
    maxHp: 50, dmgMult: 1.05, rageMult: 1.0,
    staminaCostOverrides: { laser: 0 },
    staminaDrainMult: 0.5,
    allowedActions: ['laser', 'special', 'overcharge', 'analyze', 'transfer', 'trap'],
    name:    'Маг',
    icon:    '🧙',
    color:   '#3b82f6',
    tagline: 'Бесконечные лазеры',
    passive: '🔵 Арканный: laser не тратит выносливость. Можно стрелять даже без стамины.',
    strengths:  ['Неограниченный спам лазером', 'Отличный дальний бой'],
    weaknesses: ['Мало HP', 'Стратегия легко читается противником'],
  },

  paladin: {
    ...DEFAULTS,
    maxHp: 100, dmgMult: 0.85, rageMult: 1.0,
    shieldHealAmount: 10,
    repairBonus: 10,
    maxRebootUses: 2,
    cooldownOverrides: { shield: 1 },
    allowedActions: ['attack', 'shield', 'repair', 'reflect', 'reboot', 'transfer', 'adaptive_shield'],
    name:    'Паладин',
    icon:    '⚜️',
    color:   '#f59e0b',
    tagline: 'Щит восстанавливает HP',
    passive: '✨ Святой щит: каждое использование shield восстанавливает +10 HP.',
    strengths:  ['Восстанавливает HP через щит', 'Очень высокая живучесть'],
    weaknesses: ['Самый низкий урон в игре', 'Долго убивает противника'],
  },

  sniper: {
    ...DEFAULTS,
    maxHp: 45, dmgMult: 1.0, rageMult: 1.0,
    maxChargeStacks: 8,
    cooldownOverrides:  { laser: 1 },
    actionDmgOverrides: { attack: 0.5 },
    allowedActions: ['laser', 'overcharge', 'analyze', 'sacrifice', 'special', 'trap'],
    name:    'Снайпер',
    icon:    '🎯',
    color:   '#10b981',
    tagline: 'Laser CD=1, слабый удар',
    passive: '🎯 Точный выстрел: кулдаун laser снижен до 1 хода. Но attack наносит ×0.5 урона.',
    strengths:  ['Лазер доступен почти каждый ход', 'Доминирует на дальней дистанции'],
    weaknesses: ['Слабый ближний бой (attack ×0.5)', 'Уязвим при сближении'],
  },

  tank: {
    ...DEFAULTS,
    maxHp: 120, dmgMult: 0.65, rageMult: 1.0,
    flatDmgReduction: 5,
    allowedActions: ['attack', 'shield', 'repair', 'reflect', 'reboot', 'adaptive_shield', 'transfer'],
    name:    'Рино',
    icon:    '🦏',
    color:   '#78716c',
    tagline: 'Непробиваемый носорог',
    passive: '🦏 Броня носорога: каждый входящий удар снижается на 5 HP (минимум 1). Очень живуч.',
    strengths:  ['Огромный запас HP (120)', 'Снижает абсолютно весь входящий урон'],
    weaknesses: ['Очень низкий урон (×0.65)', 'Выигрывает только измором'],
  },

  vampire: {
    ...DEFAULTS,
    maxHp: 75, dmgMult: 1.1, rageMult: 1.0,
    lifestealRate: 0.25,
    allowedActions: ['attack', 'heavy', 'special', 'sacrifice', 'reflect', 'combo'],
    name:    'Вампир',
    icon:    '🧛',
    color:   '#dc2626',
    tagline: 'Пьёт кровь в ближнем бою',
    passive: '🩸 Жизнекрадство: attack и heavy восстанавливают 25% от нанесённого урона как HP.',
    strengths:  ['Постоянно восстанавливает HP в ближнем бою', 'Долго держится при агрессии'],
    weaknesses: ['Лайфстил только от attack/heavy', 'Слаб против дальних стратегий'],
  },

  samurai: {
    ...DEFAULTS,
    maxHp: 70, dmgMult: 1.0, rageMult: 1.0,
    bushidoThreshold: 0.25,
    bushidoMult:      2.0,
    bushidoNoDefenseStreak: 3,
    allowedActions: ['attack', 'heavy', 'special', 'combo', 'overcharge', 'sacrifice'],
    name:    'Самурай',
    icon:    '🗡️',
    color:   '#f43f5e',
    tagline: 'Опасен при низком HP',
    passive: '⚔️ Бусидо: когда HP ≤ 25% от максимума — весь наносимый урон удваивается.',
    strengths:  ['Способен переломить бой при ≤25% HP', 'Урон ×2 в момент опасности'],
    weaknesses: ['Мало HP', 'Усиление только «на краю смерти»'],
  },

  phantom: {
    ...DEFAULTS,
    maxHp: 55, dmgMult: 1.05, rageMult: 1.0,
    cooldownOverrides: { dodge: 0 },
    allowedActions: ['attack', 'dodge', 'trap', 'hack', 'special', 'analyze'],
    name:    'Призрак',
    icon:    '👻',
    color:   '#a78bfa',
    tagline: 'Уклоняется каждый ход',
    passive: '👻 Фаза: кулдаун dodge = 0. Можно уклоняться каждый ход подряд.',
    strengths:  ['Бесконечное уклонение без кулдауна', 'Абсолютный контроль позиции'],
    weaknesses: ['Средний урон', 'Бесполезен против Скорпиона'],
  },

  engineer: {
    ...DEFAULTS,
    maxHp: 65, dmgMult: 0.9, rageMult: 1.0,
    specialRageCost: 60,
    maxRebootUses: 3,
    allowedActions: ['attack', 'repair', 'trap', 'reboot', 'transfer', 'analyze', 'adaptive_shield'],
    name:    'Инженер',
    icon:    '🔧',
    color:   '#f97316',
    tagline: 'Спецудар от 60 ярости',
    passive: '⚙️ Перегрузка: спецудар требует всего 60 ярости вместо 100. Активируется значительно чаще.',
    strengths:  ['Спецудар в 1.6× чаще обычного', 'Сбалансированный HP'],
    weaknesses: ['Ниже среднего базовый урон', 'Без ярости — обычный боец'],
  },

  berserker: {
    ...DEFAULTS,
    maxHp: 60, dmgMult: 1.5, rageMult: 1.0,
    rageFromDealt: true,
    berserkThreshold: 30,
    berserkMult: 2.0,
    sacrificeRageBonus: 50,
    allowedActions: ['attack', 'heavy', 'special', 'sacrifice', 'combo', 'overcharge'],
    name:    'Берсерк',
    icon:    '🪓',
    color:   '#b91c1c',
    tagline: 'Ярость от атак в обе стороны',
    passive: '🔥 Кровожажда: ярость накапливается от получаемого И от наносимого урона. Спецудар очень часто.',
    strengths:  ['Экстремальный урон ×1.5', 'Спецудар срабатывает очень часто'],
    weaknesses: ['Критически мало HP (60)', 'Умирает от 4-5 тяжёлых ударов'],
  },

  scorpion: {
    ...DEFAULTS,
    maxHp: 55, dmgMult: 1.1, rageMult: 1.0,
    attackIgnoresDodge: true,
    allowedActions: ['attack', 'trap', 'analyze', 'special', 'sacrifice', 'hack'],
    name:    'Скорпион',
    icon:    '🦂',
    color:   '#d97706',
    tagline: 'Уклонение бесполезно',
    passive: '🦂 Захват: уклонение противника не спасает от attack и heavy. GET OVER HERE!',
    strengths:  ['Атаки пробивают dodge', 'Жёсткий контрпик Призрака и Ниндзи'],
    weaknesses: ['Нет защитных механик', 'Слаб против щита и дальних атак'],
  },

  plague: {
    ...DEFAULTS,
    maxHp: 60, dmgMult: 0.9, rageMult: 1.0,
    poisonOnHit: 4,
    allowedActions: ['attack', 'analyze', 'adaptive_shield', 'trap', 'transfer', 'hack', 'special'],
    name:    'Чумной доктор',
    icon:    '🎭',
    color:   '#065f46',
    tagline: 'Каждый удар отравляет',
    passive: '☠️ Чума: attack и heavy накладывают яд — 4 HP урона каждый ход до конца раунда.',
    strengths:  ['Пассивный яд давит в затяжных боях', 'Эффективен против высокого HP'],
    weaknesses: ['Слабые прямые атаки (×0.9)', 'Почти бесполезен в быстрых боях'],
  },
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

/** Returns the emoji icon for any skin id (falls back to 🤖) */
export function getSkinIcon(skin: string): string {
  return (CHARACTER_STATS as Record<string, CharacterStats>)[skin]?.icon ?? '🤖'
}

/** Pre-built Record for places that need a simple { [skinId]: emoji } map */
export const SKIN_ICON: Record<string, string> = Object.fromEntries(
  Object.entries(CHARACTER_STATS).map(([id, c]) => [id, c.icon]),
)

/** All valid skin IDs as a const tuple — use with z.enum(ALL_SKIN_IDS) */
export const ALL_SKIN_IDS = Object.keys(CHARACTER_STATS) as [SkinId, ...SkinId[]]
