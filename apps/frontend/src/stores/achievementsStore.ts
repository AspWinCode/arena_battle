import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BattleRecord } from './dailyStore'

// ─── Achievement definitions ──────────────────────────────────────────────────

export interface AchievementDef {
  id:      string
  title:   string
  desc:    string
  icon:    string
  secret:  boolean   // shown as "???" until unlocked
  xp:      number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id:     'iron_will',
    title:  'Железная воля',
    desc:   'Победи при HP ≤ 5',
    icon:   '🩸',
    secret: false,
    xp:     150,
  },
  {
    id:     'matrix',
    title:  'Матрица',
    desc:   'Уклонись 5 раз за один бой',
    icon:   '💨',
    secret: false,
    xp:     120,
  },
  {
    id:     'berserker',
    title:  'Берсерк',
    desc:   'Используй Special 3 раза за один бой',
    icon:   '💢',
    secret: false,
    xp:     180,
  },
  {
    id:     'pacifist',
    title:  'Пацифист',
    desc:   'Победи без единого Heavy удара',
    icon:   '🕊️',
    secret: false,
    xp:     100,
  },
  {
    id:     'sniper',
    title:  'Снайпер',
    desc:   'Нанеси 80+ урона только лазером',
    icon:   '🎯',
    secret: false,
    xp:     160,
  },
  {
    id:     'untouchable',
    title:  'Неприкосновенный',
    desc:   'Победи, не получив ни одного урона',
    icon:   '🛡️',
    secret: true,
    xp:     300,
  },
  {
    id:     'economist',
    title:  'Экономист',
    desc:   'Победи, потратив ≤ 60 stamina суммарно',
    icon:   '💰',
    secret: true,
    xp:     200,
  },
  {
    id:     'rage_streak',
    title:  'Цепная реакция',
    desc:   'Имей серию побед ≥ 5 и используй Special в бою',
    icon:   '⚡',
    secret: true,
    xp:     250,
  },
]

// ─── Extended battle record for achievement checks ────────────────────────────

export interface AchievementBattleRecord extends BattleRecord {
  /** HP left at end of battle (player side) */
  finalHp:       number
  /** Damage taken this battle */
  damageTaken:   number
  /** Laser damage dealt this battle */
  laserDamage:   number
  /** Total stamina spent this battle */
  staminaSpent:  number
  /** Current win streak BEFORE this battle */
  winStreak:     number
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface UnlockedAchievement {
  id:         string
  unlockedAt: string   // ISO date
}

interface AchievementState {
  unlocked: UnlockedAchievement[]
  /** IDs pending toast display; cleared after shown */
  pendingToast: string[]
}

interface AchievementActions {
  /** Check a battle record and unlock any newly earned achievements */
  checkBattle: (rec: AchievementBattleRecord) => string[]
  /** Mark pending toasts as shown */
  clearToast: (ids: string[]) => void
  isUnlocked: (id: string) => boolean
}

export const useAchievementsStore = create<AchievementState & AchievementActions>()(
  persist(
    (set, get) => ({
      unlocked:     [],
      pendingToast: [],

      isUnlocked: (id) => get().unlocked.some(u => u.id === id),

      checkBattle: (rec) => {
        const already = new Set(get().unlocked.map(u => u.id))
        const newly: string[] = []

        const tryUnlock = (id: string, condition: boolean) => {
          if (!already.has(id) && condition) newly.push(id)
        }

        // 🩸 Железная воля — win at ≤5 HP
        tryUnlock('iron_will', rec.won && rec.finalHp <= 5)

        // 💨 Матрица — 5+ dodges in one battle
        tryUnlock('matrix', rec.dodgeUsed >= 5)

        // 💢 Берсерк — 3+ specials in one battle
        tryUnlock('berserker', rec.specialUsed >= 3)

        // 🕊️ Пацифист — win without heavy
        tryUnlock('pacifist', rec.won && rec.heavyUsed === 0)

        // 🎯 Снайпер — 80+ laser damage
        tryUnlock('sniper', rec.laserDamage >= 80)

        // 🛡️ Неприкосновенный (secret) — win with 0 damage taken
        tryUnlock('untouchable', rec.won && rec.damageTaken === 0)

        // 💰 Экономист (secret) — win using ≤60 total stamina
        tryUnlock('economist', rec.won && rec.staminaSpent <= 60)

        // ⚡ Цепная реакция (secret) — streak ≥5 AND used special
        tryUnlock('rage_streak', rec.winStreak >= 5 && rec.specialUsed > 0)

        if (newly.length === 0) return []

        const now = new Date().toISOString()
        set(s => ({
          unlocked: [
            ...s.unlocked,
            ...newly.map(id => ({ id, unlockedAt: now })),
          ],
          pendingToast: [...s.pendingToast, ...newly],
        }))

        return newly
      },

      clearToast: (ids) => {
        set(s => ({
          pendingToast: s.pendingToast.filter(id => !ids.includes(id)),
        }))
      },
    }),
    { name: 'robocode-achievements-v1' }
  )
)
