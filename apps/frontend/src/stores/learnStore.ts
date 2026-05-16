import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MissionProgress {
  completed: boolean
  stars: number      // 1–3 based on win quality
  attempts: number
}

interface LearnState {
  progress: Record<string, MissionProgress>
  theoryProgress: Record<string, boolean>
  completesMission: (id: string, stars: number) => void
  incrementAttempt: (id: string) => void
  markTheoryRead: (lessonId: string) => void
  resetProgress: () => void
}

export const useLearnStore = create<LearnState>()(
  persist(
    (set) => ({
      progress: {},
      theoryProgress: {},

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

      markTheoryRead: (lessonId) =>
        set(s => ({
          theoryProgress: { ...s.theoryProgress, [lessonId]: true },
        })),

      resetProgress: () => set({ progress: {}, theoryProgress: {} }),
    }),
    { name: 'robocode-learn-progress' }
  )
)
