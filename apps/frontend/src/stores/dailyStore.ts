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
  /** Claim XP reward for a completed task */
  claimTask:     (taskId: string) => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

const INIT: DailyState = {
  date:          '',
  tasks:         [],
  currentStreak: 0,
  bestStreak:    0,
  lastWinDate:   '',
  totalWins:     0,
  totalBattles:  0,
  totalXp:       0,
  todayXp:       0,
}

function makeTasks(date: string): DailyTaskProgress[] {
  return pickDailyTasks(date).map(t => ({
    taskId:    t.id,
    progress:  0,
    completed: false,
    claimed:   false,
  }))
}

export const useDailyStore = create<DailyState & DailyActions>()(
  persist(
    (set, get) => ({
      ...INIT,

      refreshDay: () => {
        const today = todayStr()
        if (get().date !== today) {
          set(s => ({
            date:    today,
            tasks:   makeTasks(today),
            todayXp: 0,
            // keep streak, wins, battles, xp
            currentStreak: s.currentStreak,
            bestStreak:    s.bestStreak,
            lastWinDate:   s.lastWinDate,
            totalWins:     s.totalWins,
            totalBattles:  s.totalBattles,
            totalXp:       s.totalXp,
          }))
        }
      },

      recordBattle: (rec: BattleRecord) => {
        const today = todayStr()

        set(s => {
          // ── Ensure tasks are current ──────────────────────────
          let tasks = s.tasks
          let todayXp = s.todayXp
          let date = s.date
          if (date !== today) {
            tasks    = makeTasks(today)
            todayXp  = 0
            date     = today
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

          // ── Task progress ─────────────────────────────────────
          const taskDefs = pickDailyTasks(date)
          const newTasks = tasks.map(tp => {
            const def = taskDefs.find(d => d.id === tp.taskId)
            if (!def || tp.completed) return tp

            let delta = 0
            switch (def.metric) {
              case 'wins':      delta = rec.won ? 1 : 0;         break
              case 'battles':   delta = 1;                        break
              case 'damage':    delta = rec.damageDealt;          break
              case 'turns':     delta = rec.turnsPlayed;          break
              case 'healing':   delta = rec.healing;              break
              case 'ko':        delta = rec.isKo ? 1 : 0;        break
              case 'special':   delta = rec.specialUsed;          break
              case 'heavy':     delta = rec.heavyUsed;            break
              case 'laser':     delta = rec.laserUsed;            break
              case 'dodge':     delta = rec.dodgeUsed;            break
              case 'no_repair': delta = (rec.won && !rec.usedRepair) ? 1 : 0; break
            }

            const newProgress = Math.min(def.target, tp.progress + delta)
            const completed   = newProgress >= def.target
            return { ...tp, progress: newProgress, completed }
          })

          return {
            date, tasks: newTasks, todayXp,
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

          const tasks = s.tasks.map(tp =>
            tp.taskId === taskId && tp.completed && !tp.claimed
              ? { ...tp, claimed: true }
              : tp
          )
          const earned = def.xp
          return {
            tasks,
            totalXp:  s.totalXp  + earned,
            todayXp:  s.todayXp  + earned,
          }
        })
      },
    }),
    { name: 'robocode-daily-v1' }
  )
)
