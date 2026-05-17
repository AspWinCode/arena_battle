import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Task definitions ──────────────────────────────────────────────────────────

export type TaskMetric =
  | 'wins'       // win N battles
  | 'battles'    // play N battles regardless of result
  | 'damage'     // deal N total damage
  | 'turns'      // survive N total turns
  | 'healing'    // heal N total HP
  | 'ko'         // win by KO N times
  | 'special'    // use special N times
  | 'heavy'      // use heavy N times
  | 'laser'      // use laser N times
  | 'dodge'      // use dodge N times
  | 'no_repair'  // win without using repair

export interface TaskDef {
  id:          string
  title:       string
  description: string
  icon:        string
  metric:      TaskMetric
  target:      number
  xp:          number   // reward XP points (local, cosmetic)
}

export const TASK_POOL: TaskDef[] = [
  { id: 'win1',       title: 'Первая кровь',         description: 'Выиграй 1 бой',                icon: '🏆', metric: 'wins',      target: 1,   xp: 50  },
  { id: 'win3',       title: 'Серия побед',           description: 'Выиграй 3 боя за день',        icon: '🥇', metric: 'wins',      target: 3,   xp: 120 },
  { id: 'battles5',   title: 'Боец',                  description: 'Сыграй 5 боёв',                icon: '⚔️', metric: 'battles',   target: 5,   xp: 80  },
  { id: 'battles10',  title: 'Ветеран дня',           description: 'Сыграй 10 боёв',               icon: '🎖️', metric: 'battles',   target: 10,  xp: 150 },
  { id: 'damage100',  title: 'Разрушитель',           description: 'Нанеси суммарно 100 урона',    icon: '💥', metric: 'damage',    target: 100, xp: 60  },
  { id: 'damage250',  title: 'Машина урона',          description: 'Нанеси суммарно 250 урона',    icon: '💣', metric: 'damage',    target: 250, xp: 140 },
  { id: 'turns30',    title: 'Выживший',              description: 'Продержись 30 ходов суммарно', icon: '⏱️', metric: 'turns',     target: 30,  xp: 70  },
  { id: 'turns60',    title: 'Железная воля',         description: 'Продержись 60 ходов суммарно', icon: '🏋️', metric: 'turns',     target: 60,  xp: 130 },
  { id: 'healing40',  title: 'Живучий',               description: 'Вылечи суммарно 40 HP',        icon: '💊', metric: 'healing',   target: 40,  xp: 75  },
  { id: 'ko2',        title: 'Нокаутёр',              description: 'Победи нокаутом 2 раза',       icon: '🥊', metric: 'ko',        target: 2,   xp: 100 },
  { id: 'special2',   title: 'Гнев берсерка',         description: 'Используй Special 2 раза',     icon: '☄️', metric: 'special',   target: 2,   xp: 90  },
  { id: 'heavy5',     title: 'Тяжёлая рука',          description: 'Используй Heavy 5 раз',        icon: '💪', metric: 'heavy',     target: 5,   xp: 65  },
  { id: 'laser5',     title: 'Снайпер',               description: 'Используй Laser 5 раз',        icon: '⚡', metric: 'laser',     target: 5,   xp: 65  },
  { id: 'dodge3',     title: 'Призрак',               description: 'Уклонись 3 раза успешно',      icon: '💨', metric: 'dodge',     target: 3,   xp: 70  },
  { id: 'no_repair',  title: 'Без пощады',            description: 'Выиграй бой без Repair',       icon: '🩸', metric: 'no_repair', target: 1,   xp: 110 },
]

/** Pick 3 unique tasks for a given date string (YYYY-MM-DD) */
export function pickDailyTasks(dateStr: string): TaskDef[] {
  const seed = Number(dateStr.replace(/-/g, ''))
  const pool = TASK_POOL
  const indices: number[] = []
  const multipliers = [1, 7, 13]

  for (const m of multipliers) {
    let idx = (seed * m) % pool.length
    // avoid duplicates
    while (indices.includes(idx)) idx = (idx + 1) % pool.length
    indices.push(idx)
  }

  return indices.map(i => pool[i])
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** ISO week key: YYYY-Www (e.g. 2026-W20). Stable for one calendar week. */
export function weekStr(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// ── Weekly task pool ──────────────────────────────────────────────────────────

export const WEEKLY_POOL: TaskDef[] = [
  { id: 'w_wins15',     title: 'Чемпион недели',  description: 'Выиграй 15 боёв за неделю',       icon: '👑', metric: 'wins',    target: 15,  xp: 600 },
  { id: 'w_battles25',  title: 'Марафон',         description: 'Сыграй 25 боёв за неделю',         icon: '🏃', metric: 'battles', target: 25,  xp: 500 },
  { id: 'w_damage1500', title: 'Артиллерист',     description: 'Нанеси 1500 урона за неделю',      icon: '🎯', metric: 'damage',  target: 1500, xp: 700 },
  { id: 'w_ko7',        title: 'Король нокаутов', description: 'Победи нокаутом 7 раз за неделю',  icon: '🥊', metric: 'ko',      target: 7,   xp: 800 },
  { id: 'w_turns300',   title: 'Несокрушимый',    description: 'Продержись 300 ходов за неделю',   icon: '🛡️', metric: 'turns',   target: 300, xp: 600 },
]

/** Stable weekly task pick by week string */
export function pickWeeklyTask(weekKey: string): TaskDef {
  // Use the digits of the week string as seed; fall back to length-based hash
  const digits = weekKey.replace(/\D/g, '')
  const seed = digits ? Number(digits) : weekKey.length
  return WEEKLY_POOL[seed % WEEKLY_POOL.length]
}

// ── Leagues (lifetime XP tiers) ───────────────────────────────────────────────

export interface League {
  id:        string
  name:      string
  icon:      string
  color:     string
  minXp:     number
}

export const LEAGUES: League[] = [
  { id: 'bronze',   name: 'Бронза',    icon: '🥉', color: '#cd7f32', minXp: 0     },
  { id: 'silver',   name: 'Серебро',   icon: '🥈', color: '#c0c0c0', minXp: 500   },
  { id: 'gold',     name: 'Золото',    icon: '🥇', color: '#ffd700', minXp: 1500  },
  { id: 'platinum', name: 'Платина',   icon: '💎', color: '#5dade2', minXp: 4000  },
  { id: 'diamond',  name: 'Алмаз',     icon: '🏆', color: '#a78bfa', minXp: 10000 },
]

export function getLeague(totalXp: number): { current: League; next: League | null; pct: number } {
  let current = LEAGUES[0]
  let next: League | null = LEAGUES[1] ?? null
  for (let i = 0; i < LEAGUES.length; i++) {
    if (totalXp >= LEAGUES[i].minXp) {
      current = LEAGUES[i]
      next = LEAGUES[i + 1] ?? null
    }
  }
  const pct = next
    ? Math.min(100, Math.round(((totalXp - current.minXp) / (next.minXp - current.minXp)) * 100))
    : 100
  return { current, next, pct }
}

// ── Streak multiplier ─────────────────────────────────────────────────────────

export function getStreakMultiplier(streak: number): number {
  if (streak >= 14) return 3
  if (streak >= 7)  return 2
  if (streak >= 3)  return 1.5
  return 1
}

// ── Store types ───────────────────────────────────────────────────────────────

export interface DailyTaskProgress {
  taskId:    string
  progress:  number
  completed: boolean
  claimed:   boolean
}

export interface DailyState {
  date:      string                 // YYYY-MM-DD
  tasks:     DailyTaskProgress[]    // 3 tasks for today

  // Weekly task
  week:           string             // YYYY-Www
  weeklyProgress: DailyTaskProgress | null

  // Day-completion bonus
  dayBonusClaimed: boolean           // resets with date

  // Streak
  currentStreak: number
  bestStreak:    number
  lastWinDate:   string             // YYYY-MM-DD of last win
  totalWins:     number
  totalBattles:  number
  totalXp:       number             // accumulated lifetime XP
  todayXp:       number             // XP earned today (resets with date)
}

export interface BattleRecord {
  won:          boolean
  isKo:         boolean
  damageDealt:  number
  turnsPlayed:  number
  healing:      number
  specialUsed:  number
  heavyUsed:    number
  laserUsed:    number
  dodgeUsed:    number
  usedRepair:   boolean
}

interface DailyActions {
  /** Ensure daily tasks are current; reset if date changed */
  refreshDay:    () => void
  /** Record a completed battle and update streak + task progress */
  recordBattle:  (record: BattleRecord) => void
  /** Claim XP reward for a completed daily task (streak multiplier applies) */
  claimTask:     (taskId: string) => void
  /** Claim the weekly task reward (streak multiplier applies) */
  claimWeekly:   () => void
  /** Claim the "all 3 daily tasks done" bonus (+50% of summed daily XP) */
  claimDayBonus: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

const INIT: DailyState = {
  date:            '',
  tasks:           [],
  week:            '',
  weeklyProgress:  null,
  dayBonusClaimed: false,
  currentStreak:   0,
  bestStreak:      0,
  lastWinDate:     '',
  totalWins:       0,
  totalBattles:    0,
  totalXp:         0,
  todayXp:         0,
}

function makeTasks(date: string): DailyTaskProgress[] {
  return pickDailyTasks(date).map(t => ({
    taskId:    t.id,
    progress:  0,
    completed: false,
    claimed:   false,
  }))
}

function makeWeekly(week: string): DailyTaskProgress {
  return {
    taskId:    pickWeeklyTask(week).id,
    progress:  0,
    completed: false,
    claimed:   false,
  }
}

function applyMetricDelta(metric: TaskMetric, rec: BattleRecord): number {
  switch (metric) {
    case 'wins':      return rec.won ? 1 : 0
    case 'battles':   return 1
    case 'damage':    return rec.damageDealt
    case 'turns':     return rec.turnsPlayed
    case 'healing':   return rec.healing
    case 'ko':        return rec.isKo ? 1 : 0
    case 'special':   return rec.specialUsed
    case 'heavy':     return rec.heavyUsed
    case 'laser':     return rec.laserUsed
    case 'dodge':     return rec.dodgeUsed
    case 'no_repair': return (rec.won && !rec.usedRepair) ? 1 : 0
  }
}

// ── Backend sync helper ───────────────────────────────────────────────────────

export function syncStatsToBackend(state: DailyState, token: string): void {
  const { currentStreak, bestStreak, totalXp, totalWins, totalBattles, lastWinDate } = state
  fetch('/api/v1/user/profile/~me/stats', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentStreak, bestStreak, totalXp, totalWins, totalBattles, lastWinDate }),
  }).catch(() => { /* silent — offline or unauthenticated */ })
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDailyStore = create<DailyState & DailyActions>()(
  persist(
    (set, get) => ({
      ...INIT,

      refreshDay: () => {
        const today = todayStr()
        const wk    = weekStr()
        set(s => {
          const next: Partial<DailyState> = {}
          if (s.date !== today) {
            next.date            = today
            next.tasks           = makeTasks(today)
            next.todayXp         = 0
            next.dayBonusClaimed = false
          }
          if (s.week !== wk) {
            next.week           = wk
            next.weeklyProgress = makeWeekly(wk)
          }
          return Object.keys(next).length > 0 ? next : s
        })
      },

      recordBattle: (rec: BattleRecord) => {
        const today = todayStr()
        const wk    = weekStr()

        set(s => {
          // ── Rollover guards ──────────────────────────────────
          let tasks = s.tasks
          let todayXp = s.todayXp
          let date = s.date
          let dayBonusClaimed = s.dayBonusClaimed
          if (date !== today) {
            tasks            = makeTasks(today)
            todayXp          = 0
            date             = today
            dayBonusClaimed  = false
          }

          let week           = s.week
          let weeklyProgress = s.weeklyProgress
          if (week !== wk || !weeklyProgress) {
            week           = wk
            weeklyProgress = makeWeekly(wk)
          }

          // ── Streak ────────────────────────────────────────────
          let { currentStreak, bestStreak, lastWinDate, totalWins, totalBattles } = s
          totalBattles++
          if (rec.won) {
            totalWins++
            currentStreak++
            lastWinDate = today
            if (currentStreak > bestStreak) bestStreak = currentStreak
          } else {
            currentStreak = 0
          }

          // ── Daily task progress ───────────────────────────────
          const taskDefs = pickDailyTasks(date)
          const newTasks = tasks.map(tp => {
            const def = taskDefs.find(d => d.id === tp.taskId)
            if (!def || tp.completed) return tp
            const delta = applyMetricDelta(def.metric, rec)
            const newProgress = Math.min(def.target, tp.progress + delta)
            const completed   = newProgress >= def.target
            return { ...tp, progress: newProgress, completed }
          })

          // ── Weekly progress ───────────────────────────────────
          const weeklyDef = pickWeeklyTask(week)
          let newWeekly = weeklyProgress
          if (newWeekly.taskId === weeklyDef.id && !newWeekly.completed) {
            const delta = applyMetricDelta(weeklyDef.metric, rec)
            const wp    = Math.min(weeklyDef.target, newWeekly.progress + delta)
            newWeekly   = { ...newWeekly, progress: wp, completed: wp >= weeklyDef.target }
          }

          return {
            date, tasks: newTasks, todayXp, dayBonusClaimed,
            week, weeklyProgress: newWeekly,
            currentStreak, bestStreak, lastWinDate,
            totalWins, totalBattles,
          }
        })
      },

      claimTask: (taskId: string) => {
        set(s => {
          const taskDefs = pickDailyTasks(s.date)
          const def = taskDefs.find(d => d.id === taskId)
          if (!def) return s
          const tp = s.tasks.find(t => t.taskId === taskId)
          if (!tp || !tp.completed || tp.claimed) return s

          const multiplier = getStreakMultiplier(s.currentStreak)
          const earned     = Math.round(def.xp * multiplier)
          const tasks      = s.tasks.map(t =>
            t.taskId === taskId ? { ...t, claimed: true } : t
          )
          return {
            tasks,
            totalXp: s.totalXp + earned,
            todayXp: s.todayXp + earned,
          }
        })
      },

      claimWeekly: () => {
        set(s => {
          const def = pickWeeklyTask(s.week)
          const wp  = s.weeklyProgress
          if (!wp || wp.taskId !== def.id || !wp.completed || wp.claimed) return s

          const multiplier = getStreakMultiplier(s.currentStreak)
          const earned     = Math.round(def.xp * multiplier)
          return {
            weeklyProgress: { ...wp, claimed: true },
            totalXp: s.totalXp + earned,
            todayXp: s.todayXp + earned,
          }
        })
      },

      claimDayBonus: () => {
        set(s => {
          if (s.dayBonusClaimed) return s
          const allClaimed = s.tasks.length > 0 && s.tasks.every(t => t.claimed)
          if (!allClaimed) return s

          const dailyDefs = pickDailyTasks(s.date)
          const baseSum   = dailyDefs.reduce((sum, d) => sum + d.xp, 0)
          const bonus     = Math.round(baseSum * 0.5)
          return {
            dayBonusClaimed: true,
            totalXp: s.totalXp + bonus,
            todayXp: s.todayXp + bonus,
          }
        })
      },
    }),
    { name: 'robocode-daily-v2' }
  )
)
