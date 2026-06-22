import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type Auth } from 'firebase/auth'
import { useAuthStore, type AdminUser } from '@/stores/auth'

export default defineNuxtPlugin(async () => {
  // E2E fast-path: skip Firebase entirely when addInitScript set __donyAuthSeed
  // (null = unauthenticated test, object = authenticated test).
  // This unblocks onMounted hooks and keeps plugin init < 1 ms in tests.
  if ('__donyAuthSeed' in (window as unknown as Record<string, unknown>)) {
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

      if (firebaseUser && !authStore.isAuthenticated) {
        try {
          const idToken = await firebaseUser.getIdToken()
          const adminUser = await $fetch<AdminUser>(`${pub.apiBaseUrl}/admin/me`, {
            headers: { Authorization: `Bearer ${idToken}` },
          }).catch(() => null)

          if (adminUser) {
            authStore.setSession(idToken, adminUser)
          } else {
            await auth.signOut()
          }
        } catch {
          authStore.clear()
        }
      }

      resolve()
    })
  })

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
