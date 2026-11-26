import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'
import {
  ACTIVITY_KEY, FUTURE_TOLERANCE_MS, LOCK_ROUTE, idleLoginRoute, isActivityStale, isMobileAppPath, markLocked,
  readLastActivity, rememberLockContext, resolveIdleMinutes, resolveIdleMs, writeLastActivity,
} from '@/features/mobile/lib/lockState'

// API historique de ce module, gardée pour les écrans qui l'importent d'ici.
export {
  LOCK_ROUTE, DEFAULT_IDLE_MS, LOCK_CONTEXT_KEY, isSafeReturnPath, readLockContext, clearLockContext,
  type LockContext,
} from '@/features/mobile/lib/lockState'

/** Au plus une écriture de `lastActivityAt` dans le stockage toutes les 5 s. */
const STORAGE_THROTTLE_MS = 5000

/** Avertissement de la console de bureau : 60 s avant la fermeture de la session. */
export const WARNING_LEAD_MS = 60 * 1000

/**
 * Entrées de l'utilisateur, et elles seules : un envoi de fichier ou un export en cours ne compte
 * pas. Écoutées en phase de capture sur `window`, donc avant la page : un `scroll` dans un
 * conteneur (il ne remonte pas jusqu'à `window` ; le contenu de la console défile dans `<main>`) et
 * une touche qu'un composant arrête (`stopPropagation`) comptent aussi, et une entrée arrivée après
 * l'échéance peut être arrêtée avant d'atteindre la page.
 *
 * Écoute passive là où le défilement se joue (jamais de `preventDefault`) ; clavier et pointeur
 * annulables, pour qu'une entrée sur une session expirée ne déclenche rien (Entrée qui soumet).
 */
const PASSIVE_EVENTS = ['touchstart', 'wheel', 'scroll', 'input'] as const
const CANCELABLE_EVENTS = ['pointerdown', 'keydown'] as const
/** Actions nées d'une entrée : arrêtées seulement une fois la session close. */
const GUARD_EVENTS = ['click', 'submit'] as const
const PASSIVE = { passive: true, capture: true } as const
const CAPTURE = { capture: true } as const

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

export interface IdleLock {
  lockNow: () => Promise<void>
  lastActivityAt: Ref<number>
  /** Bandeau « Votre session va se fermer pour inactivité » à afficher (option `warn`). */
  warning: Ref<boolean>
  /** « Rester connecté » : activité enregistrée tout de suite (tous les onglets), bandeau fermé. */
  stayConnected: () => void
}

/**
 * Fermeture de session après `idleMs` sans activité, pour toute la console (bureau et `/m`).
 * À l'échéance (ou au retour au premier plan si le délai s'est écoulé en arrière-plan) : marqueur de
 * verrou posé, déconnexion Firebase SANS révoquer le push, store vidé (échec fermé). Destination :
 * {@link LOCK_ROUTE} sous `/m` (dans la portée de l'app installée), sinon `/login` avec la page
 * quittée en retour. L'activité est partagée entre onglets du même navigateur (stockage).
 *
 * Inerte côté serveur et sans admin connecté. À appeler une fois par layout authentifié ; `warn`
 * (bureau) expose {@link IdleLock.warning} 60 s avant l'échéance.
 */
export function useIdleLock(options: { idleMs?: number, warn?: boolean } = {}): IdleLock {
  const route = useRoute()
  const auth = useAuthStore()
  const idleMs = effectiveIdleMs(options.idleMs, route.query?.idle, Boolean(import.meta.dev), configuredIdleMinutes())
  // 60 s ; moitié du délai pour un `?idle=` de développement plus court que deux minutes.
  const warnLeadMs = Math.min(WARNING_LEAD_MS, Math.floor(idleMs / 2))
  const lastActivityAt = ref(Date.now())
  const warning = ref(false)
  let lockTimer: ReturnType<typeof setTimeout> | null = null
  let warnTimer: ReturnType<typeof setTimeout> | null = null
  let lastWrite = 0
  let locking = false
  let mounted = false
  /** Session close (fermée ou en cours de fermeture) : plus aucune entrée n'atteint la page. */
  let sealed = false

  const active = (): boolean => mounted && auth.isAuthenticated
  const inMobileApp = (): boolean => isMobileAppPath(route.path ?? '')

  /** Dernière activité connue, y compris celle d'un autre onglet (stockage partagé). */
  function lastKnownActivity(): number {
    return Math.max(lastActivityAt.value, readLastActivity())
  }

  function isExpired(): boolean {
    return isActivityStale(lastKnownActivity(), Date.now(), idleMs)
  }

  /**
   * L'échéance est-elle déjà passée au moment d'une entrée ? Le minuteur peut ne pas avoir tourné :
   * veille de l'ordinateur (les minuteurs suivent une horloge qui s'arrête pendant la veille), page
   * gelée, longue tâche, entrée traitée avant le minuteur. Pré-filtre en mémoire (dernier geste de
   * cet onglet) ; l'activité partagée (un autre onglet a pu travailler) n'est lue que si besoin.
   */
  function expiredOnInput(now: number): boolean {
    const own = lastActivityAt.value
    if (now - own < idleMs && own <= now + FUTURE_TOLERANCE_MS) return false
    return isExpired()
  }

  /** Entrée arrêtée avant la page (et annulée si l'écoute le permet). */
  function block(e: Event, cancelable: boolean): void {
    e.stopImmediatePropagation()
    if (cancelable && e.cancelable) e.preventDefault()
  }

  /** Temps restant avant l'échéance, borné à [0, idleMs]. */
  function msLeft(): number {
    if (isExpired()) return 0
    return Math.min(idleMs, Math.max(0, idleMs - (Date.now() - lastKnownActivity())))
  }

  function persist(now: number, force = false): void {
    if (!force && now - lastWrite < STORAGE_THROTTLE_MS) return
    lastWrite = now
    writeLastActivity(now)
  }

  function clearTimers(): void {
    if (lockTimer) clearTimeout(lockTimer)
    if (warnTimer) clearTimeout(warnTimer)
    lockTimer = null
    warnTimer = null
  }

  async function lockNow(): Promise<void> {
    if (locking || !auth.isAuthenticated || route.path === LOCK_ROUTE) return
    locking = true
    sealed = true
    clearTimers()
    warning.value = false
    try {
      const mobile = inMobileApp()
      if (mobile) {
        rememberLockContext({
          path: isAppRelative(route.fullPath) ? route.fullPath : null,
          email: auth.user?.email ?? null,
        })
      }
      const destination = mobile ? LOCK_ROUTE : idleLoginRoute(route.fullPath ?? route.path ?? '/')
      // Posé AVANT la déconnexion : si l'app est tuée ou rechargée pendant le signOut (toucher
      // d'une notification), ou si Firebase refuse de se déconnecter, le plugin au redémarrage
      // ne restaure pas la session.
      markLocked('idle')
      const { signOut } = useFirebaseAuth()
      const lockSignOut = () => signOut({ revokePush: false, redirectTo: destination })
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
      await navigateTo(destination)
    } finally {
      locking = false
    }
  }

  /**
   * Minuteurs recalculés depuis la dernière activité connue (avertissement compris). Appelée
   * seulement avec un admin connecté et le layout monté.
   */
  function schedule(): void {
    clearTimers()
    const left = msLeft()
    lockTimer = setTimeout(onLockTimer, left)
    if (!options.warn) return
    if (left <= warnLeadMs) {
      warning.value = true
    } else {
      warning.value = false
      warnTimer = setTimeout(onWarnTimer, left - warnLeadMs)
    }
  }

  function onWarnTimer(): void {
    warnTimer = null
    if (!active()) return
    // Activité entre-temps (cet onglet ou un autre) : on repart du nouveau délai.
    if (msLeft() > warnLeadMs) schedule()
    else warning.value = true
  }

  function onLockTimer(): void {
    lockTimer = null
    if (!active()) return
    // Section mobile en arrière-plan : contrôle au retour (visibilitychange), comme avant. Un onglet
    // de bureau caché se ferme à l'échéance : rien ne reste visible quand on y revient.
    if (document.visibilityState === 'hidden' && inMobileApp()) return
    if (isExpired()) void lockNow()
    else schedule()
  }

  function onInput(e: Event, cancelable: boolean): void {
    if (sealed) return block(e, cancelable)
    if (!active()) return
    const now = Date.now()
    // Échéance passée sans que le minuteur ait tourné : l'entrée ferme la session au lieu de la
    // prolonger, n'est pas horodatée, et n'atteint pas la page (rien ne part avec l'ancienne session).
    if (expiredOnInput(now)) {
      block(e, cancelable)
      void lockNow()
      return
    }
    lastActivityAt.value = now
    persist(now)
    // Les minuteurs relisent la dernière activité à leur échéance ; seul le bandeau est à fermer.
    if (warning.value) schedule()
  }

  const onPassiveInput = (e: Event): void => onInput(e, false)
  const onCancelableInput = (e: Event): void => onInput(e, true)
  const onGuard = (e: Event): void => { if (sealed) block(e, true) }

  function stayConnected(): void {
    if (sealed || !active()) return
    const now = Date.now()
    // Bandeau resté affiché pendant une veille : « Rester connecté » ne rouvre pas la session.
    if (expiredOnInput(now)) {
      void lockNow()
      return
    }
    lastActivityAt.value = now
    persist(now, true)
    schedule()
  }

  function onVisibility(): void {
    if (document.visibilityState !== 'visible' || !active()) return
    if (isExpired()) void lockNow()
    else schedule()
  }

  function onPageShow(e: PageTransitionEvent): void {
    // Retour depuis le cache avant/arrière (bfcache) : même contrôle que visibilitychange.
    if (e.persisted) onVisibility()
  }

  function onStorage(e: StorageEvent): void {
    // Activité d'un autre onglet : le bandeau de celui-ci se ferme, le délai repart.
    if (e.key === ACTIVITY_KEY && active()) schedule()
  }

  /** Démarrage avec un admin connecté : la dernière activité stockée est comparée AVANT d'écrire. */
  function start(): void {
    if (!active()) return
    const now = Date.now()
    // App relancée (ou ouverte depuis un autre onglet) après plus de `idleMs` sans activité, ou
    // horodatage douteux (futur) : fermeture tout de suite.
    if (isActivityStale(readLastActivity(), now, idleMs)) {
      void lockNow()
      return
    }
    resume(now)
  }

  function resume(now: number = Date.now()): void {
    lastActivityAt.value = now
    persist(now, true)
    schedule()
  }

  // Connexion pendant que le layout est monté : une session neuve, l'inactivité repart de
  // maintenant. Déconnexion : plus de minuteur ni de bandeau.
  watch(() => auth.isAuthenticated, (signedIn) => {
    if (!mounted) return
    if (signedIn) {
      sealed = false
      resume()
    }
    else {
      clearTimers()
      warning.value = false
    }
  })

  onMounted(() => {
    mounted = true
    for (const evt of PASSIVE_EVENTS) window.addEventListener(evt, onPassiveInput, PASSIVE)
    for (const evt of CANCELABLE_EVENTS) window.addEventListener(evt, onCancelableInput, CAPTURE)
    for (const evt of GUARD_EVENTS) window.addEventListener(evt, onGuard, CAPTURE)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('storage', onStorage)
    start()
  })

  onBeforeUnmount(() => {
    mounted = false
    for (const evt of PASSIVE_EVENTS) window.removeEventListener(evt, onPassiveInput, PASSIVE)
    for (const evt of CANCELABLE_EVENTS) window.removeEventListener(evt, onCancelableInput, CAPTURE)
    for (const evt of GUARD_EVENTS) window.removeEventListener(evt, onGuard, CAPTURE)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pageshow', onPageShow)
    window.removeEventListener('storage', onStorage)
    clearTimers()
  })

  return { lockNow, lastActivityAt, warning, stayConnected }
}
