import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'

/** Page de verrouillage : publique, hors onglets. */
export const LOCK_ROUTE = '/m/verrouille'
export const DEFAULT_IDLE_MS = 30 * 60 * 1000
/** Au plus une écriture de `lastActivityAt` dans le stockage toutes les 5 s. */
const STORAGE_THROTTLE_MS = 5000
const ACTIVITY_KEY = 'yadony-admin-last-activity'
/** Page à retrouver (et e-mail à préremplir) après le verrouillage : session de l'onglet seulement. */
export const LOCK_CONTEXT_KEY = 'yadony-admin-lock-context'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const

/**
 * Chemin applicatif sûr pour revenir après le verrouillage : jamais une URL absolue ni `//hôte`
 * (redirection ouverte), uniquement l'app mobile (`/m...`), et pas la page de verrouillage elle-même.
 */
export function isSafeReturnPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false
  if (!/^\/m(?:[/?#]|$)/.test(path)) return false
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f]/.test(path)) return false
  if (path === LOCK_ROUTE || path.startsWith(`${LOCK_ROUTE}?`) || path.startsWith(`${LOCK_ROUTE}#`)
    || path.startsWith(`${LOCK_ROUTE}/`)) return false
  return true
}

/** Chemin relatif à l'appli (un seul `/` initial), valable à mémoriser. */
function isAppRelative(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
}

export interface LockContext { path: string | null, email: string | null }

let memoryContext: LockContext = { path: null, email: null }

function rememberLockContext(ctx: LockContext): void {
  memoryContext = ctx
  try { sessionStorage.setItem(LOCK_CONTEXT_KEY, JSON.stringify(ctx)) } catch { /* mémoire seule */ }
}

export function readLockContext(): LockContext {
  try {
    const raw = sessionStorage.getItem(LOCK_CONTEXT_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { path?: unknown, email?: unknown }
      return {
        path: typeof p.path === 'string' ? p.path : null,
        email: typeof p.email === 'string' ? p.email : null,
      }
    }
  } catch { /* repli mémoire */ }
  return memoryContext
}

export function clearLockContext(): void {
  memoryContext = { path: null, email: null }
  try { sessionStorage.removeItem(LOCK_CONTEXT_KEY) } catch { /* rien à faire */ }
}

/**
 * Délai d'inactivité effectif. Le paramètre `?idle=<ms>` (ex. `?idle=10000` pour tester le verrou
 * en 10 s) n'est lu QUE en développement (`import.meta.dev`) : ignoré dans un build de production.
 */
export function resolveIdleMs(option: number | undefined, queryIdle: unknown, isDev: boolean): number {
  if (option && option > 0) return option
  if (isDev && typeof queryIdle === 'string') {
    const n = Number(queryIdle)
    if (Number.isFinite(n) && n > 0) return n
  }
  return DEFAULT_IDLE_MS
}

function readStoredActivity(): number {
  try {
    const n = Number(localStorage.getItem(ACTIVITY_KEY))
    return Number.isFinite(n) ? n : 0
  } catch { return 0 }
}

/**
 * Verrou d'inactivité de l'app mobile : après `idleMs` sans activité (ou au retour au premier plan
 * si le délai s'est écoulé en arrière-plan), déconnecte Firebase côté client SANS révoquer le push
 * (les notifications continuent d'arriver, un toucher mène à l'écran de verrouillage) et ouvre
 * {@link LOCK_ROUTE}. À appeler une fois, depuis le layout mobile.
 */
export function useIdleLock(options?: { idleMs?: number }): { lockNow: () => Promise<void>, lastActivityAt: Ref<number> } {
  const route = useRoute()
  const idleMs = resolveIdleMs(options?.idleMs, route.query?.idle, Boolean(import.meta.dev))
  const lastActivityAt = ref(Date.now())
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastWrite = 0
  let locking = false

  /** Dernière activité connue, y compris celle d'un autre onglet (stockage partagé). */
  function lastKnownActivity(): number {
    return Math.max(lastActivityAt.value, readStoredActivity())
  }

  function persist(now: number): void {
    if (now - lastWrite < STORAGE_THROTTLE_MS) return
    lastWrite = now
    try { localStorage.setItem(ACTIVITY_KEY, String(now)) } catch { /* mémoire seule */ }
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
      try {
        await useFirebaseAuth().signOut({ revokePush: false })
      } catch { /* la session locale est de toute façon fermée ci-dessous */ }
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

  onMounted(() => {
    const now = Date.now()
    lastActivityAt.value = now
    persist(now)
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    arm()
  })

  onBeforeUnmount(() => {
    for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity)
    document.removeEventListener('visibilitychange', onVisibility)
    if (timer) clearTimeout(timer)
    timer = null
  })

  return { lockNow, lastActivityAt }
}
