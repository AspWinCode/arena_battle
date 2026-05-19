import { Division, GameTopic, Language } from '@robocode/shared'
import { prisma } from '../db/client.js'

// ─── Division thresholds ────────────────────────────────────────────────────

export const DIVISION_THRESHOLDS = {
  DIVISION_2: { ratingToExit: 300, winsToExit: 15 },
  DIVISION_1: { ratingToExit: 1500, winsToExit: 60, topicsToExit: 5 },
  PREMIER_LEAGUE: null, // no exit
} as const

// ─── Points per event ───────────────────────────────────────────────────────

export const POINTS = {
  DIVISION_2: {
    win_normal: 15,
    win_rated: 30,
    win_cross_div: 50,
    win_cross_tournament: 40,
    topic_unlock: 20,
    streak_3: 15,
    loss_normal: 0,
    loss_rated: 0,
  },
  DIVISION_1: {
    win_normal: 20,
    win_rated: 40,
    win_cross_div: 60,
    win_cross_tournament: 50,
    topic_unlock: 20,
    streak_3: 20,
    loss_normal: 0,
    loss_rated: -5,
  },
  PREMIER_LEAGUE: {
    win_normal: 30,
    win_rated: 60,
    win_cross_div: 0,
    win_cross_tournament: 70,
    topic_unlock: 20,
    streak_3: 25,
    loss_normal: -5,
    loss_rated: -15,
  },
} as const

// ─── Available actions per division / topic progress ────────────────────────

export function getAvailableActions(division: Division, unlockedTopicsCount: number): string[] {
  const base = ['attack', 'dodge', 'shield']

  if (division === 'DIVISION_2') {
    // combo and laser open after 15 wins (handled separately via block editor unlock)
    return base
  }

  // DIVISION_1 and above
  const extended = [...base, 'combo', 'laser', 'trap', 'repair']
  return extended
}

// ─── Available context vars per topic progress ───────────────────────────────

export function getContextVars(unlockedTopicsCount: number): string[] {
  const base = ['hp', 'enemy_hp', 'round']
  if (unlockedTopicsCount >= 5) {
    base.push('my_history', 'enemy_history')
  }
  if (unlockedTopicsCount >= 11) {
    base.push('round_log')
  }
  return base
}

// ─── Division features description ──────────────────────────────────────────

export function getDivisionUnlockedFeatures(to: Division): string[] {
  if (to === 'DIVISION_1') {
    return ['text_editor', 'combo_action', 'laser_action', 'trap_action', 'repair_action']
  }
  if (to === 'PREMIER_LEAGUE') {
    return ['code_limit_500', 'state_object', 'async_battles', 'elo_rating', 'battle_functions']
  }
  return []
}

// ─── Check and apply division promotion ─────────────────────────────────────

export async function checkDivisionPromotion(userId: string): Promise<{
  promoted: boolean
  from?: Division
  to?: Division
  unlockedFeatures?: string[]
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      division: true,
      rating: true,
      totalWins: true,
      progress: { select: { unlockedTopics: true } },
    },
  })

  if (!user) return { promoted: false }

  const { division, rating, totalWins, progress } = user
  const topicsCount = progress?.unlockedTopics?.length ?? 0

  let targetDivision: Division | null = null

  if (division === 'DIVISION_2') {
    const { ratingToExit, winsToExit } = DIVISION_THRESHOLDS.DIVISION_2
    if (rating >= ratingToExit && totalWins >= winsToExit) {
      targetDivision = 'DIVISION_1'
    }
  } else if (division === 'DIVISION_1') {
    const { ratingToExit, winsToExit, topicsToExit } = DIVISION_THRESHOLDS.DIVISION_1
    if (rating >= ratingToExit && totalWins >= winsToExit && topicsCount >= topicsToExit) {
      targetDivision = 'PREMIER_LEAGUE'
    }
  }

  if (!targetDivision) return { promoted: false }

  await prisma.user.update({
    where: { id: userId },
    data: { division: targetDivision },
  })

  const unlockedFeatures = getDivisionUnlockedFeatures(targetDivision)

  return {
    promoted: true,
    from: division as Division,
    to: targetDivision,
    unlockedFeatures,
  }
}

// ─── Add rating points ───────────────────────────────────────────────────────

export async function addRatingPoints(
  userId: string,
  event: keyof typeof POINTS['DIVISION_2'],
): Promise<{ newRating: number; promoted: boolean; from?: Division; to?: Division }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { division: true, rating: true },
  })
  if (!user) return { newRating: 0, promoted: false }

  const divPoints = POINTS[user.division as Division] as Record<string, number>
  const delta = divPoints[event] ?? 0

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { rating: { increment: delta } },
    select: { rating: true },
  })

  const promotion = await checkDivisionPromotion(userId)

  return {
    newRating: updated.rating,
    promoted: promotion.promoted,
    from: promotion.from,
    to: promotion.to,
  }
}

// ─── Topic open conditions ───────────────────────────────────────────────────

export const TOPIC_LIST: GameTopic[] = [
  'PRINT', 'ASSIGNMENT', 'VARIABLES_INPUT', 'SEP_END_LEN', 'DATA_TYPES',
  'ARITHMETIC', 'MATH_MODULE', 'LOGIC', 'IF_ELSE_ELIF', 'FOR_LOOP',
  'WHILE_LOOP', 'NESTED_LOOPS', 'INDEXING', 'STRING_SLICES', 'ARRAYS_1D',
  'ARRAYS_2D', 'SETS', 'TUPLES', 'FUNCTIONS_BASIC', 'FUNCTIONS_PARAMS',
  'LOCAL_VARS', 'GLOBAL_VARS', 'FUNCTIONS_RETURN', 'FUNCTIONS_BOOL',
  'FUNCTIONS_MULTI_RETURN', 'DICTS', 'SETS_ADVANCED',
]

export const TOPIC_LABELS: Record<GameTopic, string> = {
  PRINT: 'Print',
  ASSIGNMENT: 'Оператор присваивания',
  VARIABLES_INPUT: 'Переменные и Input',
  SEP_END_LEN: 'Sep, end, len',
  DATA_TYPES: 'Типы данных',
  ARITHMETIC: 'Арифметика',
  MATH_MODULE: 'Модуль math',
  LOGIC: 'Логические операции',
  IF_ELSE_ELIF: 'If / Else / Elif',
  FOR_LOOP: 'Цикл for',
  WHILE_LOOP: 'Цикл while',
  NESTED_LOOPS: 'Вложенные циклы',
  INDEXING: 'Индексация',
  STRING_SLICES: 'Срезы строк',
  ARRAYS_1D: 'Одномерные массивы',
  ARRAYS_2D: 'Двумерные массивы',
  SETS: 'Множества',
  TUPLES: 'Кортежи',
  FUNCTIONS_BASIC: 'Функции без параметров',
  FUNCTIONS_PARAMS: 'Функции с параметром',
  LOCAL_VARS: 'Локальные переменные',
  GLOBAL_VARS: 'Глобальные переменные',
  FUNCTIONS_RETURN: 'Функции с возвратом',
  FUNCTIONS_BOOL: 'Функции с bool',
  FUNCTIONS_MULTI_RETURN: 'Функции с несколькими возвратами',
  DICTS: 'Словари',
  SETS_ADVANCED: 'Множества в Python',
}

// Tasks needed to unlock / wins needed to unlock a topic
export const TASKS_TO_UNLOCK = 10
export const WINS_TO_UNLOCK = 5

export async function checkTopicUnlock(userId: string): Promise<{
  unlocked: boolean
  topic?: GameTopic
  newActionsUnlocked?: string[]
  newContextVarsUnlocked?: string[]
}> {
  const progress = await prisma.playerProgress.findUnique({
    where: { userId },
    select: {
      unlockedTopics: true,
      topicTasksDone: true,
      winsAfterLastTopic: true,
    },
  })

  if (!progress) return { unlocked: false }

  const unlockedSet = new Set(progress.unlockedTopics as GameTopic[])
  const tasksDone = progress.topicTasksDone as Record<string, number>

  // Find the next topic in sequence that isn't unlocked yet
  const nextTopic = TOPIC_LIST.find((t) => !unlockedSet.has(t))
  if (!nextTopic) return { unlocked: false } // all topics done

  const tasksForTopic = tasksDone[nextTopic] ?? 0
  const winsOk = progress.winsAfterLastTopic >= WINS_TO_UNLOCK
  // First topic has no task requirement — user needs wins only to bootstrap
  const tasksOk = unlockedSet.size === 0 || tasksForTopic >= TASKS_TO_UNLOCK

  if (!winsOk || !tasksOk) return { unlocked: false }

  // Unlock it
  const newUnlocked = [...progress.unlockedTopics, nextTopic] as GameTopic[]

  await prisma.playerProgress.update({
    where: { userId },
    data: {
      unlockedTopics: newUnlocked,
      winsAfterLastTopic: 0,
    },
  })

  // Award rating points for topic unlock
  await prisma.user.update({
    where: { id: userId },
    data: { rating: { increment: POINTS.DIVISION_2.topic_unlock } },
  })

  const prevCount = unlockedSet.size
  const newCount = newUnlocked.length

  // Check if new context vars became available
  const prevVars = getContextVars(prevCount)
  const newVars = getContextVars(newCount)
  const newContextVarsUnlocked = newVars.filter((v) => !prevVars.includes(v))

  return {
    unlocked: true,
    topic: nextTopic,
    newContextVarsUnlocked: newContextVarsUnlocked.length ? newContextVarsUnlocked : undefined,
  }
}

// ─── Ensure PlayerProgress exists ───────────────────────────────────────────

export async function ensureProgress(userId: string) {
  return prisma.playerProgress.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
}
