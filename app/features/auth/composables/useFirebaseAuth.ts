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

  async function signIn(login: string, password: string): Promise<AdminUser> {
    if (!$firebaseAuth) {
      throw new Error('Firebase Auth non initialisé. Vérifie la configuration Firebase dans .env.')
    }
    const email = `${login}@admin.dony.invalid`
    const credential = await signInWithEmailAndPassword($firebaseAuth, email, password)
    const idToken = await credential.user.getIdToken()
    authStore.idToken = idToken
    const adminUser = await api<AdminUser>('/admin/me')
    authStore.setSession(idToken, adminUser)
    return adminUser
  }

  async function signOut(): Promise<void> {
    if ($firebaseAuth) {
      await fbSignOut($firebaseAuth)
    }
    authStore.clear()
    await navigateTo('/login')
  }

  return { signIn, signOut }
}
