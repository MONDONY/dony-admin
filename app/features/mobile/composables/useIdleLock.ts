import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'
import {
  LOCK_ROUTE, isActivityStale, markLocked, readLastActivity, rememberLockContext, resolveIdleMinutes,
  resolveIdleMs, writeLastActivity,
} from '@/features/mobile/lib/lockState'

// API historique de ce module, gardée pour les écrans qui l'importent d'ici.
export {
  LOCK_ROUTE, DEFAULT_IDLE_MS, LOCK_CONTEXT_KEY, isSafeReturnPath, readLockContext, clearLockContext,
  type LockContext,
} from '@/features/mobile/lib/lockState'

/** Au plus une écriture de `lastActivityAt` dans le stockage toutes les 5 s. */
const STORAGE_THROTTLE_MS = 5000

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const

/** Chemin relatif à l'appli (un seul `/` initial), valable à mémoriser. */
function isAppRelative(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
}

/**
 * Durée configurée (`runtimeConfig.public.idleLockMinutes`, bornée par {@link resolveIdleMinutes}).
 * Hors contexte Nuxt (appel après un `await`, tests sans configuration) : 30 minutes.
 */
export function configuredIdleMinutes(): number {
  let raw: unknown
  try { raw = useRuntimeConfig().public.idleLockMinutes } catch { raw = undefined }
  return resolveIdleMinutes(raw)
}

/**
 * Délai d'inactivité effectif : la durée configurée. Le paramètre `?idle=<ms>` (ex. `?idle=10000`
 * pour tester le verrou en 10 s) n'est lu QUE en développement (`import.meta.dev`) : ignoré dans
 * un build de production, où les bornes de la configuration s'appliquent toujours.
 */
export function effectiveIdleMs(option: number | undefined, queryIdle: unknown, isDev: boolean, configMinutes: unknown): number {
  if (option && option > 0) return option
  if (isDev && typeof queryIdle === 'string') {
    const n = Number(queryIdle)
    if (Number.isFinite(n) && n > 0) return n
  }
  return resolveIdleMs(configMinutes)
}

/**
 * Verrou d'inactivité de l'app mobile : après `idleMs` sans activité (ou au retour au premier plan
 * si le délai s'est écoulé en arrière-plan), déconnecte Firebase côté client SANS révoquer le push
 * (les notifications continuent d'arriver, un toucher mène à l'écran de verrouillage) et ouvre
 * {@link LOCK_ROUTE}. À appeler une fois, depuis le layout mobile.
 */
export function useIdleLock(options?: { idleMs?: number }): { lockNow: () => Promise<void>, lastActivityAt: Ref<number> } {
  const route = useRoute()
  const idleMs = effectiveIdleMs(options?.idleMs, route.query?.idle, Boolean(import.meta.dev), configuredIdleMinutes())
  const lastActivityAt = ref(Date.now())
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastWrite = 0
  let locking = false

  /** Dernière activité connue, y compris celle d'un autre onglet (stockage partagé). */
  function lastKnownActivity(): number {
    return Math.max(lastActivityAt.value, readLastActivity())
  }

  function persist(now: number): void {
    if (now - lastWrite < STORAGE_THROTTLE_MS) return
    lastWrite = now
    writeLastActivity(now)
  }

  async function lockNow(): Promise<void> {
    const auth = useAuthStore()
    if (locking || !auth.isAuthenticated || route.path === LOCK_ROUTE) return
    locking = true
    try {
      rememberLockContext({
        path: isAppRelative(route.fullPath) ? route.fullPath : null,
        email: auth.user?.email ?? null,
      })
      // Posé AVANT la déconnexion : si l'app est tuée ou rechargée pendant le signOut (toucher
      // d'une notification), ou si Firebase refuse de se déconnecter, le plugin au redémarrage
      // ne restaure pas la session.
      markLocked('idle')
      const { signOut } = useFirebaseAuth()
      const lockSignOut = () => signOut({ revokePush: false, redirectTo: LOCK_ROUTE })
      try {
        await lockSignOut()
      } catch {
        // Échec fermé : le store est vidé ci-dessous quoi qu'il arrive, le marqueur empêche toute
        // restauration au prochain démarrage ; une seconde tentative de déconnexion Firebase part
        // en arrière-plan (meilleur effort).
        void lockSignOut().catch(() => {})
      } finally {
        auth.clear()
      }
      await navigateTo(LOCK_ROUTE)
    } finally {
      locking = false
    }
  }

  function arm(): void {
    if (timer) clearTimeout(timer)
    const remaining = Math.max(0, idleMs - (Date.now() - lastKnownActivity()))
    timer = setTimeout(onTimer, remaining)
  }

  function onTimer(): void {
    timer = null
    // En arrière-plan, le contrôle se fait au retour (visibilitychange).
    if (document.visibilityState === 'hidden') return
    if (Date.now() - lastKnownActivity() >= idleMs) void lockNow()
    else arm()
  }

  function onActivity(): void {
    const now = Date.now()
    lastActivityAt.value = now
    persist(now)
    arm()
  }

  function onVisibility(): void {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastKnownActivity() >= idleMs) void lockNow()
    else arm()
  }

  function onPageShow(e: PageTransitionEvent): void {
    // Retour depuis le cache avant/arrière (bfcache) : même contrôle que visibilitychange.
    if (e.persisted) onVisibility()
  }

  onMounted(() => {
    const now = Date.now()
    // Comparer AVANT d'écraser : l'app relancée (ou rouverte depuis la console de bureau) après
    // plus de `idleMs` sans activité mobile se verrouille tout de suite.
    const stale = isActivityStale(readLastActivity(), now, idleMs)
    if (!stale) {
      lastActivityAt.value = now
      persist(now)
    }
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    if (stale) void lockNow()
    arm()
  })

  onBeforeUnmount(() => {
    for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pageshow', onPageShow)
    if (timer) clearTimeout(timer)
    timer = null
  })

  return { lockNow, lastActivityAt }
}
