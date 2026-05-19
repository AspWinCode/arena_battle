import { api } from './client'
import type { GameTopic, Division, Language } from '@robocode/shared'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TopicProgress {
  id: GameTopic
  label: string
  level: 1 | 2 | 3
  unlocked: boolean
  tasksDone: number
  tasksRequired: number
  winsRequired: number
  battlesSinceLastUse: number
}

export interface PlayerProgressData {
  division: Division
  language: Language
  rating: number
  totalWins: number
  eloRating: number
  unlockedTopics: GameTopic[]
  topicTasksDone: Record<string, number>
  winsAfterLastTopic: number
  availableActions: string[]
  contextVars: string[]
}

export interface DivisionProgressData {
  division: Division
  language: Language
  rating: number
  totalWins: number
  eloRating: number
  topicsUnlocked: number
  progressToNext: {
    ratingProgress: number
    ratingThreshold: number
    winsProgress: number
    winsThreshold: number
    topicsProgress: number | null
    topicsThreshold: number | null
    percentComplete: number
  } | null
  availableActions: string[]
  contextVars: string[]
}

export interface Task {
  id: string
  topic: GameTopic
  language: Language
  title: string
  description: string
  testCases?: Array<{ input: string | null; expected_output: string }>
  hint?: string
  difficulty: number
  orderIndex: number
  completed: boolean
}

export interface TaskRunResult {
  passed: boolean
  results: Array<{ input: string | null; expected: string; actual: string; passed: boolean }>
  error?: string
  topicUnlocked?: GameTopic | null
  newContextVars?: string[]
}

export interface Recommendation {
  id: string
  trigger: 'after_loss' | 'after_win' | 'topic_unused'
  topic: GameTopic
  message: string
  codeExample: string
  cta: string
}

export interface RatingPlayer {
  id: string
  username: string
  displayName: string
  avatar: string
  division: Division
  rating: number
  totalWins: number
}

// ─── Progress API ─────────────────────────────────────────────────────────────

export const progressApi = {
  getProgress: (token: string) =>
    api.get<PlayerProgressData>('/progress', token),

  getTopics: (token: string) =>
    api.get<{ topics: TopicProgress[]; language: Language }>('/progress/topics', token),

  unlockTopic: (topicId: string, token: string) =>
    api.post<{ ok: boolean; topic: GameTopic; newContextVars?: string[] }>(
      `/progress/topics/${topicId}/unlock`, {}, token,
    ),
}

// ─── Tasks API ────────────────────────────────────────────────────────────────

export const tasksApi = {
  getTasks: (token: string, topic?: string) =>
    api.get<{ tasks: Task[] }>(
      `/tasks${topic ? `?topic=${topic}` : ''}`,
      token,
    ),

  getTask: (taskId: string, token: string) =>
    api.get<Task>(`/tasks/${taskId}`, token),

  submitTask: (taskId: string, code: string, token: string) =>
    api.post<TaskRunResult>(`/tasks/${taskId}/submit`, { code }, token),
}

// ─── Divisions API ────────────────────────────────────────────────────────────

export const divisionsApi = {
  getMyDivision: (token: string) =>
    api.get<DivisionProgressData>('/divisions/me', token),

  checkPromotion: (token: string) =>
    api.post<{ promoted: boolean; from?: Division; to?: Division; unlockedFeatures?: string[] }>(
      '/divisions/check-promotion', {}, token,
    ),

  getRating: (token: string, division?: Division, limit = 50) =>
    api.get<{ players: RatingPlayer[]; total: number }>(
      `/divisions/rating${division ? `?division=${division}&limit=${limit}` : `?limit=${limit}`}`,
      token,
    ),

  getMyPosition: (token: string) =>
    api.get<{ position: number; division: Division; rating: number }>(
      '/divisions/rating/me', token,
    ),
}

// ─── Recommendations API ──────────────────────────────────────────────────────

export const recommendationsApi = {
  getRecommendations: (token: string) =>
    api.get<{ recommendations: Recommendation[] }>('/recommendations', token),

  dismiss: (id: string, token: string) =>
    api.post<{ ok: boolean }>(`/recommendations/${id}/dismiss`, {}, token),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const DIVISION_LABELS: Record<Division, string> = {
  DIVISION_2: '2-й дивизион',
  DIVISION_1: '1-й дивизион',
  PREMIER_LEAGUE: 'Высшая лига',
}

export const DIVISION_ICONS: Record<Division, string> = {
  DIVISION_2: '🥉',
  DIVISION_1: '🥇',
  PREMIER_LEAGUE: '👑',
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  PYTHON: 'Python',
  JAVASCRIPT: 'JavaScript',
  JAVA: 'Java',
  CPP: 'C++',
}

export const LANGUAGE_ICONS: Record<Language, string> = {
  PYTHON: '🐍',
  JAVASCRIPT: '🟨',
  JAVA: '☕',
  CPP: '⚙️',
}
