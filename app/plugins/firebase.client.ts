import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type Auth } from 'firebase/auth'
import { useAuthStore, type AdminUser } from '@/stores/auth'
import { buildFirebaseConfig } from '@/lib/firebaseConfig'
import { hasTotpFactor } from '@/features/auth/composables/useFirebaseAuth'
import {
  appPathFromLocation, isActivityStale, markLocked, readLastActivity, readLockMarker, resolveIdleMs,
  sessionEndRoute,
} from '@/features/mobile/lib/lockState'

/**
 * Faut-il refuser la session restaurée au démarrage ? Sur TOUTES les pages (bureau compris : sur
 * Android, l'app installée partage le stockage de Chrome ; tuée avant son minuteur, la session
 * revenait sans mot de passe sur la console de bureau) : marqueur de verrou posé, ou dernière
 * activité enregistrée vieille d'au moins `idleMs` (ou dans le futur). Aucune activité enregistrée
 * (premier lancement, stockage vidé, mise en service de l'expiration) : la session passe, le layout
 * l'horodate. Stockage illisible : idem, le minuteur des layouts reste actif.
 */
function lockedAtStartup(now: number, idleMs: number): 'marker' | 'idle' | null {
  if (readLockMarker()) return 'marker'
  if (isActivityStale(readLastActivity(), now, idleMs)) return 'idle'
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

  await new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe()

      const locked = firebaseUser ? lockedAtStartup(Date.now(), resolveIdleMs(pub.idleLockMinutes)) : null
      if (firebaseUser && locked) {
        // Verrou toujours en vigueur (app tuée en arrière-plan puis relancée, déconnexion
        // Firebase échouée, rechargement pendant le verrouillage) : la session restaurée depuis
        // IndexedDB est refermée et le store n'est jamais rempli. Nuxt attend ce plugin avant
        // d'installer l'app : aucune page privée n'est montée avant cette déconnexion. Le
        // middleware mène ensuite à /login (bureau) ou à la page de verrouillage (/m).
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
