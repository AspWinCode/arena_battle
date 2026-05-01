// ── Perks system ──────────────────────────────────────────────────────────────
// Perks are unlocked by completing missions and can be applied in Sparring mode.
// Each perk modifies initial battle state or game constants for the player.

export interface PerkEffect {
  bonusHp?:             number   // extra HP at battle start (max 100)
  bonusStamina?:        number   // extra stamina at battle start
  bonusRage?:           number   // extra rage at battle start
  heavyThreshold?:      number   // override STAMINA_THRESHOLD_HEAVY (default 35)
  shieldAbsorb?:        number   // override SHIELD_ABSORB fraction (default 0.6)
  laserCooldownReduce?: number   // reduce laser cooldown by N turns
  heavyCooldownReduce?: number   // reduce heavy cooldown by N turns
}

export interface Perk {
  id:          string
  name:        string
  description: string
  icon:        string
  unlockAt:    number   // missions completed needed to unlock
  effect:      PerkEffect
}

export const PERKS: Perk[] = [
  {
    id: 'iron_skin',
    name: 'Железная шкура',
    description: 'Начинаешь бой с +20 HP (максимум 100)',
    icon: '🛡️',
    unlockAt: 1,
    effect: { bonusHp: 20 },
  },
  {
    id: 'rage_seed',
    name: 'Семя ярости',
    description: 'Начинаешь с 40 единицами ярости',
    icon: '😤',
    unlockAt: 2,
    effect: { bonusRage: 40 },
  },
  {
    id: 'quick_draw',
    name: 'Быстрый выстрел',
    description: 'Перезарядка Laser сокращена на 1 ход',
    icon: '⚡',
    unlockAt: 3,
    effect: { laserCooldownReduce: 1 },
  },
  {
    id: 'heavy_training',
    name: 'Силовая тренировка',
    description: 'Heavy можно использовать от 25 выносливости вместо 35',
    icon: '💪',
    unlockAt: 4,
    effect: { heavyThreshold: 25 },
  },
  {
    id: 'shield_pro',
    name: 'Мастер щита',
    description: 'Shield поглощает 75% урона вместо 60%',
    icon: '🔰',
    unlockAt: 5,
    effect: { shieldAbsorb: 0.75 },
  },
  {
    id: 'stamina_boost',
    name: 'Железные лёгкие',
    description: 'Начинаешь с дополнительными +30 выносливости',
    icon: '💨',
    unlockAt: 6,
    effect: { bonusStamina: 30 },
  },
  {
    id: 'quick_heavy',
    name: 'Молниеносный удар',
    description: 'Перезарядка Heavy сокращена на 1 ход',
    icon: '🔨',
    unlockAt: 7,
    effect: { heavyCooldownReduce: 1 },
  },
  {
    id: 'berserker_soul',
    name: 'Душа берсерка',
    description: '+15 HP и начинаешь с 50 единицами ярости',
    icon: '☄️',
    unlockAt: 8,
    effect: { bonusHp: 15, bonusRage: 50 },
  },
]

/** Merge multiple perk effects into one combined effect */
export function mergeEffects(perks: Perk[]): PerkEffect {
  const out: PerkEffect = {}
  for (const p of perks) {
    const e = p.effect
    if (e.bonusHp)             out.bonusHp             = (out.bonusHp ?? 0) + e.bonusHp
    if (e.bonusStamina)        out.bonusStamina        = (out.bonusStamina ?? 0) + e.bonusStamina
    if (e.bonusRage)           out.bonusRage           = (out.bonusRage ?? 0) + e.bonusRage
    if (e.heavyThreshold)      out.heavyThreshold      = Math.min(out.heavyThreshold ?? 999, e.heavyThreshold)
    if (e.shieldAbsorb)        out.shieldAbsorb        = Math.max(out.shieldAbsorb ?? 0, e.shieldAbsorb)
    if (e.laserCooldownReduce) out.laserCooldownReduce = (out.laserCooldownReduce ?? 0) + e.laserCooldownReduce
    if (e.heavyCooldownReduce) out.heavyCooldownReduce = (out.heavyCooldownReduce ?? 0) + e.heavyCooldownReduce
  }
  return out
}
