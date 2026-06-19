import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  type ConfirmationResult,
} from 'firebase/auth'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { registerWebDevice } from '@/composables/useDeviceRegistration'

let recaptchaVerifier: RecaptchaVerifier | null = null
let confirmation: ConfirmationResult | null = null

export function useFirebaseAuth() {
  const { $firebaseAuth } = useNuxtApp()
  const authStore = useAuthStore()
  const api = useApi()

  async function sendOtp(phoneNumber: string, recaptchaContainerId: string): Promise<void> {
    if (!$firebaseAuth) {
      throw new Error('Firebase Auth non initialisé. Vérifie la configuration Firebase dans .env.development.')
    }
    if (!recaptchaVerifier) {
      recaptchaVerifier = new RecaptchaVerifier($firebaseAuth, recaptchaContainerId, {
        size: 'invisible',
      })
    }
    confirmation = await signInWithPhoneNumber($firebaseAuth, phoneNumber, recaptchaVerifier)
  }

  async function confirmOtp(code: string): Promise<AuthUser> {
    if (!confirmation) {
      throw new Error("OTP non envoyé. Appelle sendOtp() d'abord.")
    }
    const credential = await confirmation.confirm(code)
    const idToken = await credential.user.getIdToken()
    authStore.idToken = idToken
    const user = await api<AuthUser>('/auth/me')
    authStore.setSession(idToken, user)
    void registerWebDevice()
    return user
  }

  async function signOut(): Promise<void> {
    await fbSignOut($firebaseAuth)
    authStore.clear()
    recaptchaVerifier = null
    confirmation = null
    await navigateTo('/')
  }

  return { sendOtp, confirmOtp, signOut }
}
