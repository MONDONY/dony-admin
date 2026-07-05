import type { Auth } from 'firebase/auth'
import { useAuthStore } from '@/stores/auth'
import { getDeviceId } from '@/lib/deviceId'

let apiInstance: any = null

export function useApi(): ReturnType<typeof $fetch.create> {
  if (apiInstance) return apiInstance

  const config = useRuntimeConfig()
  const auth = useAuthStore()

  apiInstance = $fetch.create({
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
      const existing = (options.headers as Record<string, string>) ?? {}
      const headers: Record<string, string> = { ...existing }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      const deviceId = getDeviceId()
      if (deviceId) {
        headers['X-Device-Id'] = deviceId
      }
      options.headers = headers
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        auth.clear()
        navigateTo('/login')
      }
    },
  })

  return apiInstance
}

export function _resetApiInstance(): void {
  apiInstance = null
}
