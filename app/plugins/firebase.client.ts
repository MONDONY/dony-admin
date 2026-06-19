import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type Auth } from 'firebase/auth'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import { isCurrentDeviceRegistered } from '@/composables/useDeviceRegistration'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  const pub = config.public as Record<string, string>

  // Sans clés Firebase (mode démo local / e2e), on n'initialise PAS Firebase :
  // getAuth() jetterait `auth/invalid-api-key` et casserait toute l'application.
  // La session est alors fournie par seed (window.__donyAuthSeed via expose-auth)
  // ou par la connexion démo ; $firebaseAuth reste null.
  if (!pub.firebaseApiKey) {
    return { provide: { firebaseApp: null, firebaseAuth: null } }
  }

  const firebaseConfig = {
    apiKey: pub.firebaseApiKey,
    authDomain: pub.firebaseAuthDomain,
    projectId: pub.firebaseProjectId,
    appId: pub.firebaseAppId,
  }

  const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)
  const auth: Auth = getAuth(app)
  const authStore = useAuthStore()

  // Await Firebase's initial auth-state check — it reads its IndexedDB storage
  // and calls back with the restored user (or null). Nuxt blocks route middleware
  // until all async plugins resolve, so auth.global.ts always sees the right state.
  await new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe()

      if (firebaseUser && !authStore.isAuthenticated) {
        try {
          const idToken = await firebaseUser.getIdToken()
          const user = await $fetch<AuthUser>(`${pub.apiBaseUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${idToken}` },
          }).catch(() => null)

          if (user) {
            authStore.setSession(idToken, user)
            // La session est restaurée passivement (pas une connexion explicite) :
            // on ne ré-enregistre PAS l'appareil (sinon une session révoquée
            // réapparaîtrait). À la place, on vérifie qu'on n'a pas été révoqué.
            const stillRegistered = await isCurrentDeviceRegistered()
            if (!stillRegistered) {
              await auth.signOut()
              authStore.clear()
            }
          } else {
            // Backend rejected the token (account deleted, etc.) — clean up
            await auth.signOut()
          }
        } catch {
          authStore.clear()
        }
      }

      resolve()
    })
  })

  // Ongoing listener: keep the token fresh when Firebase rotates it,
  // and clear the store if the user signs out from another tab.
  // Skip the clear in E2E dev mode where auth is seeded via window.__donyAuthSeed.
  const hasE2ESeed = !!(window as unknown as { __donyAuthSeed?: unknown }).__donyAuthSeed
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const freshToken = await firebaseUser.getIdToken()
      if (authStore.idToken && freshToken !== authStore.idToken) {
        authStore.idToken = freshToken
      }
    } else if (authStore.isAuthenticated && !hasE2ESeed) {
      authStore.clear()
      navigateTo('/login')
    }
  })

  return { provide: { firebaseApp: app, firebaseAuth: auth } }
})
