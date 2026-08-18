import type { Auth } from 'firebase/auth'
import { signOut as fbSignOut } from 'firebase/auth'
import { useAuthStore } from '@/stores/auth'
import { getDeviceId } from '@/lib/deviceId'

let apiInstance: any = null

export function useApi(): ReturnType<typeof $fetch.create> {
  // Cache uniquement côté client : en SSR une instance module-scope serait
  // partagée entre requêtes (fuite du store Pinia de la 1re requête).
  const isClient = typeof window !== 'undefined'
  if (isClient && apiInstance) return apiInstance

  const config = useRuntimeConfig()
  const auth = useAuthStore()

  async function clearFirebaseSession(): Promise<void> {
    const { $firebaseAuth } = useNuxtApp()
    if ($firebaseAuth) {
      await Promise.resolve(fbSignOut($firebaseAuth as Auth)).catch(() => {})
    }
    auth.clear()
    await navigateTo('/login')
  }

  const instance = $fetch.create({
    baseURL: config.public.apiBaseUrl as string,
    async onRequest({ options }) {
      const { $firebaseAuth } = useNuxtApp()
      const firebaseUser = ($firebaseAuth as Auth | null)?.currentUser
      let token = auth.idToken
      if (firebaseUser) {
        try {
          token = await firebaseUser.getIdToken()
          if (token !== auth.idToken) auth.idToken = token
        } catch { /* use cached token */ }
      }
      const headers = new Headers(options.headers)
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      const deviceId = getDeviceId()
      if (deviceId) {
        headers.set('X-Device-Id', deviceId)
      }
      options.headers = headers
    },
    async onResponseError({ response }) {
      if (response.status === 401) {
        await clearFirebaseSession()
        return
      }
      const code = (response._data as { code?: string } | undefined)?.code
      if (response.status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') {
        await navigateTo('/change-password')
      }
      // Other 403s keep the session — the caller decides how to react.
    },
  })

  if (isClient) apiInstance = instance
  return instance
}

export function _resetApiInstance(): void {
  apiInstance = null
}
