import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserProfile {
  id: string
  email: string
  username: string
  displayName: string
  avatar: string
  bio: string | null
  preferredLang: string
  preferredSkin: string
  experienceLevel: string
  programmingYears: number
}

interface UserState {
  user: UserProfile | null
  token: string | null
  setAuth: (user: UserProfile, token: string) => void
  updateUser: (patch: Partial<UserProfile>) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user:  null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      updateUser: (patch) => set(s => ({ user: s.user ? { ...s.user, ...patch } : null })),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'robocode-user' }
  )
)
