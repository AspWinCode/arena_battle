import { create } from 'zustand'
import { progressApi, divisionsApi, recommendationsApi } from '../api/progress'
import type {
  PlayerProgressData,
  DivisionProgressData,
  TopicProgress,
  Recommendation,
} from '../api/progress'

interface ProgressState {
  progress: PlayerProgressData | null
  division: DivisionProgressData | null
  topics: TopicProgress[]
  recommendations: Recommendation[]
  loading: boolean

  fetchProgress: (token: string) => Promise<void>
  fetchDivision: (token: string) => Promise<void>
  fetchTopics: (token: string) => Promise<void>
  fetchRecommendations: (token: string) => Promise<void>
  dismissRecommendation: (id: string, token: string) => void
  reset: () => void
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  progress: null,
  division: null,
  topics: [],
  recommendations: [],
  loading: false,

  fetchProgress: async (token) => {
    try {
      const data = await progressApi.getProgress(token)
      set({ progress: data })
    } catch {
      // silent fail
    }
  },

  fetchDivision: async (token) => {
    try {
      const data = await divisionsApi.getMyDivision(token)
      set({ division: data })
    } catch {
      // silent fail
    }
  },

  fetchTopics: async (token) => {
    try {
      const data = await progressApi.getTopics(token)
      set({ topics: data.topics })
    } catch {
      // silent fail
    }
  },

  fetchRecommendations: async (token) => {
    try {
      const data = await recommendationsApi.getRecommendations(token)
      set({ recommendations: data.recommendations })
    } catch {
      // silent fail
    }
  },

  dismissRecommendation: (id, token) => {
    set((s) => ({ recommendations: s.recommendations.filter((r) => r.id !== id) }))
    recommendationsApi.dismiss(id, token).catch(() => {})
  },

  reset: () => set({ progress: null, division: null, topics: [], recommendations: [] }),
}))
