import { defineStore } from 'pinia'

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT'

export interface AdminUser {
  id: string
  login: string
  role: AdminRole
  status: string
  mustChangePassword: boolean
  permissionOverrides: Record<string, boolean>
}

interface AuthState {
  idToken: string | null
  user: AdminUser | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    idToken: null,
    user: null,
  }),
  getters: {
    isAuthenticated: (state): boolean =>
      state.idToken !== null && state.user !== null,
    isAdmin: (state): boolean =>
      state.user?.role === 'SUPER_ADMIN' || state.user?.role === 'ADMIN' || state.user?.role === 'SUPPORT',
    isSupport: (state): boolean =>
      state.user?.role === 'SUPPORT',
  },
  actions: {
    setSession(token: string, user: AdminUser) {
      this.idToken = token
      this.user = user
      if (import.meta.client) {
        localStorage.setItem('dony-admin-session', JSON.stringify({ token, user }))
      }
    },
    clear() {
      this.idToken = null
      this.user = null
      if (import.meta.client) {
        localStorage.removeItem('dony-admin-session')
      }
    },
    rehydrate() {
      if (!import.meta.client) return
      const stored = localStorage.getItem('dony-admin-session')
      if (!stored) return
      try {
        const { token, user } = JSON.parse(stored)
        this.idToken = token
        this.user = user
      } catch {
        localStorage.removeItem('dony-admin-session')
      }
    },
  },
})
