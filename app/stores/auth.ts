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
      state.user?.role != null,
  },
  actions: {
    setSession(token: string, user: AdminUser) {
      this.idToken = token
      this.user = user
    },
    clear() {
      this.idToken = null
      this.user = null
    },
  },
})
