import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminState {
  accessToken: string | null
  setToken: (token: string | null) => void
  isAuthenticated: () => boolean
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      setToken: (token) => set({ accessToken: token }),
      isAuthenticated: () => {
        const token = get().accessToken
        if (!token) return false
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          return payload.exp * 1000 > Date.now()
        } catch {
          return false
        }
      },
    }),
    { name: 'admin-auth' }
  )
)
