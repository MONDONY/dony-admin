import { defineStore } from 'pinia'

export interface AuthUser {
  id: string
  phoneNumber: string
  displayName: string
  isProAccount: boolean
  roles: string[]
  avatarUrl: string | null
}

interface AuthState {
  idToken: string | null
  user: AuthUser | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    idToken: null,
    user: null,
  }),
  getters: {
    isAuthenticated: (state): boolean =>
      state.idToken !== null && state.user !== null,
    isProAccount: (state): boolean =>
      state.user?.isProAccount ?? false,
  },
  actions: {
    setSession(token: string, user: AuthUser) {
      this.idToken = token
      this.user = user
    },
    clear() {
      this.idToken = null
      this.user = null
    },
  },
})
