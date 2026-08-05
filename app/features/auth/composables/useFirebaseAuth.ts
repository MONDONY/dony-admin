import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth'
import { useAuthStore, type AdminUser } from '@/stores/auth'
import { useApi } from '@/composables/useApi'

export function useFirebaseAuth() {
  const { $firebaseAuth } = useNuxtApp()
  const authStore = useAuthStore()
  const api = useApi()

  async function refreshProfile(token?: string): Promise<AdminUser> {
    if (token) {
      authStore.idToken = token
    }
    const adminUser = await api<AdminUser>('/admin/me')
    authStore.setSession(authStore.idToken ?? '', adminUser)
    return adminUser
  }

  async function signIn(email: string, password: string): Promise<AdminUser> {
    if (!$firebaseAuth) {
      throw new Error('Firebase Auth non initialisé. Vérifie la configuration Firebase dans .env.')
    }
    const normalized = email.trim().toLowerCase()
    const credential = await signInWithEmailAndPassword($firebaseAuth, normalized, password)
    const token = await credential.user.getIdToken(true)
    return refreshProfile(token)
  }

  async function signOut(): Promise<void> {
    if ($firebaseAuth) {
      await fbSignOut($firebaseAuth)
    }
    authStore.clear()
    await navigateTo('/login')
  }

  return { signIn, signOut, refreshProfile }
}
