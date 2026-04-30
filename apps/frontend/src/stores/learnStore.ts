import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MissionProgress {
  completed: boolean
  stars: number      // 1–3 based on win quality
  attempts: number
}

interface LearnState {
  progress: Record<string, MissionProgress>
  completesMission: (id: string, stars: number) => void
  incrementAttempt: (id: string) => void
  resetProgress: () => void
}

export const useLearnStore = create<LearnState>()(
  persist(
    (set) => ({
      progress: {},

      completesMission: (id, stars) =>
        set(s => ({
          progress: {
            ...s.progress,
            [id]: {
              completed: true,
              stars: Math.max(stars, s.progress[id]?.stars ?? 0),
              attempts: s.progress[id]?.attempts ?? 1,
            },
          },
        })),

      incrementAttempt: (id) =>
        set(s => ({
          progress: {
            ...s.progress,
            [id]: {
              ...s.progress[id],
              completed: s.progress[id]?.completed ?? false,
              stars: s.progress[id]?.stars ?? 0,
              attempts: (s.progress[id]?.attempts ?? 0) + 1,
            },
          },
        })),

      resetProgress: () => set({ progress: {} }),
    }),
    { name: 'robocode-learn-progress' }
  )
)
