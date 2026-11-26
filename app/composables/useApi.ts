import type { Auth } from 'firebase/auth'
import { signOut as fbSignOut } from 'firebase/auth'
import { useAuthStore } from '@/stores/auth'
import { getDeviceId } from '@/lib/deviceId'
import { appPathFromLocation, sessionEndRoute } from '@/features/mobile/lib/lockState'

let apiInstance: any = null

/** `useRoute()`, ou null hors contexte Nuxt. */
function tryRoute(): { fullPath?: string } | null {
  try { return useRoute() } catch { return null }
}

export function useApi(): ReturnType<typeof $fetch.create> {
  // Cache uniquement côté client : en SSR une instance module-scope serait
  // partagée entre requêtes (fuite du store Pinia de la 1re requête).
  const isClient = typeof window !== 'undefined'
  if (isClient && apiInstance) return apiInstance

  const config = useRuntimeConfig()
  const auth = useAuthStore()

  const onServer = import.meta.server || typeof window === 'undefined'
  /**
   * Route de la requête, côté serveur, lue ici (contexte Nuxt disponible) : dans le crochet d'erreur,
   * après des `await`, `useRoute()` peut ne plus trouver l'app. L'objet suit la route courante.
   */
  const serverRoute = onServer ? tryRoute() : null

  /**
   * Page courante de l'appli. Ce crochet d'erreur peut tourner pendant le rendu serveur, sans
   * `window` (`import.meta.server` dans le build Nuxt ; le test de `window` couvre aussi un
   * environnement où cette constante n'est pas remplacée, comme Vitest) : la route de Nuxt y sert.
   */
  function currentAppPath(): string {
    if (onServer) return (serverRoute ?? tryRoute())?.fullPath || '/'
    return appPathFromLocation(config.app?.baseURL)
  }

  async function clearFirebaseSession(): Promise<void> {
    const { $firebaseAuth } = useNuxtApp()
    if ($firebaseAuth) {
      await Promise.resolve(fbSignOut($firebaseAuth as Auth)).catch(() => {})
    }
    auth.clear()
    // Section mobile : page de verrouillage, la page courante y est retenue (jamais /login).
    await navigateTo(sessionEndRoute(currentAppPath()))
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
      // Le back exige le second facteur : inscription si l'admin n'en a pas, sinon cette
      // session a été ouverte sans le code (avant l'inscription) et doit être refaite.
      if (response.status === 403 && code === 'ADMIN_MFA_REQUIRED') {
        if (auth.mfaEnrolled) {
          await clearFirebaseSession()
        } else {
          await navigateTo('/mfa-setup')
        }
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
