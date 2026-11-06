import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type Auth } from 'firebase/auth'
import { useAuthStore, type AdminUser } from '@/stores/auth'
import { hasTotpFactor } from '@/features/auth/composables/useFirebaseAuth'

export default defineNuxtPlugin<{ firebaseApp: FirebaseApp | null; firebaseAuth: Auth | null }>(async () => {
  // E2E fast-path: skip Firebase entirely when addInitScript set __yadonyAuthSeed
  // (null = unauthenticated test, object = authenticated test).
  // This unblocks onMounted hooks and keeps plugin init < 1 ms in tests.
  if (import.meta.dev && '__yadonyAuthSeed' in (window as unknown as Record<string, unknown>)) {
    return { provide: { firebaseApp: null, firebaseAuth: null } }
  }

  const config = useRuntimeConfig()
  const pub = config.public as Record<string, string>

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

  await new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe()

      if (firebaseUser) {
        // Le backend est la seule source de vérité pour role/status/mustChangePassword :
        // on recharge toujours /admin/me au démarrage, jamais de cache local.
        try {
          const idToken = await firebaseUser.getIdToken()
          authStore.idToken = idToken
          const adminUser = await $fetch<AdminUser>(`${pub.apiBaseUrl}/admin/me`, {
            headers: { Authorization: `Bearer ${idToken}` },
          })
          authStore.setSession(idToken, adminUser)
        } catch {
          await auth.signOut().catch(() => {})
          authStore.clear()
        }
        // État d'inscription du second facteur, lu à part : une erreur ici ne doit pas
        // couper la session, l'état reste alors inconnu (aucune redirection forcée).
        if (authStore.isAuthenticated) {
          try {
            authStore.setMfaEnrolled(hasTotpFactor(firebaseUser))
          } catch { /* état inconnu */ }
        }
      }

      resolve()
    })
  })

  const hasE2ESeed = import.meta.dev && !!(window as unknown as { __yadonyAuthSeed?: unknown }).__yadonyAuthSeed
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
