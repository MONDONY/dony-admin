import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type Auth } from 'firebase/auth'
import { useAuthStore, type AdminUser } from '@/stores/auth'
import { buildFirebaseConfig } from '@/lib/firebaseConfig'
import { hasTotpFactor } from '@/features/auth/composables/useFirebaseAuth'
import {
  appPathFromLocation, isActivityStale, isMobileAppPath, markLocked, readLastActivity, readLockMarker,
  resolveIdleMs, sessionEndRoute,
} from '@/features/mobile/lib/lockState'

/**
 * Faut-il refuser la session restaurée au démarrage ? Le marqueur de verrou s'applique partout ;
 * l'expiration après `idleMs` sans activité mobile seulement dans la section `/m` (le bureau n'a
 * pas d'expiration). Stockage illisible : aucune des deux conditions, la session est restaurée
 * comme avant (le minuteur d'inactivité du layout mobile reste actif).
 */
function lockedAtStartup(appPath: string, now: number, idleMs: number): 'marker' | 'idle' | null {
  if (readLockMarker()) return 'marker'
  if (isMobileAppPath(appPath) && isActivityStale(readLastActivity(), now, idleMs)) return 'idle'
  return null
}

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

  // messagingSenderId compris : sans lui, getMessaging() lève messaging/missing-app-config-values.
  const firebaseConfig = buildFirebaseConfig(pub)

  const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)
  const auth: Auth = getAuth(app)
  const authStore = useAuthStore()
  // URL d'arrivée (app relancée, toucher d'une notification) : lue avant toute navigation.
  const initialAppPath = appPathFromLocation(config.app?.baseURL)

  await new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe()

      const locked = firebaseUser
        ? lockedAtStartup(initialAppPath, Date.now(), resolveIdleMs(pub.idleLockMinutes))
        : null
      if (firebaseUser && locked) {
        // Verrou toujours en vigueur (app tuée en arrière-plan puis relancée, déconnexion
        // Firebase échouée, rechargement pendant le verrouillage) : la session restaurée depuis
        // IndexedDB est refermée et le store n'est jamais rempli.
        if (locked === 'idle') markLocked('idle')
        await auth.signOut().catch(() => {})
        authStore.clear()
      } else if (firebaseUser) {
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
      // Section mobile : page de verrouillage (jamais /login, hors de la portée de l'app installée).
      navigateTo(sessionEndRoute(appPathFromLocation(config.app?.baseURL)))
    }
  })

  return { provide: { firebaseApp: app, firebaseAuth: auth } }
})
