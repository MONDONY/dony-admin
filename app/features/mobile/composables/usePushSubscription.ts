import { ref, type Ref } from 'vue'
import { getMessaging, getToken, deleteToken, type Messaging } from 'firebase/messaging'
import type { FirebaseApp } from 'firebase/app'
import { mobileService } from '@/features/mobile/services/mobileService'
import { buildWebDeviceName } from '@/composables/useDeviceRegistration'
import { useAuthStore } from '@/stores/auth'
import { resolveMessagingSenderId } from '@/lib/firebaseConfig'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'
/** Cause d'un échec d'activation, affichée sous le bouton (`config` : clés ou projet Firebase). */
export type PushError = 'config' | 'permission' | 'generic'

const TOKEN_KEY = 'yadony-admin-push-token'
/** Attente maximale de l'activation du service worker au premier abonnement. */
export const SW_ACTIVATION_TIMEOUT_MS = 10_000

/**
 * Instances FCM qui connaissent la registration `/m/` (fournie à getToken dans ce document).
 * Sur une page neuve, `deleteToken` du SDK enregistrerait son service worker par défaut à la
 * racine du site (`/firebase-messaging-sw.js`, hors de `/siragbe/`) : il n'est appelé que sur
 * ces instances, la désinscription passe sinon par la registration `/m/` elle-même.
 */
const boundMessaging = new WeakSet<object>()

class PushSetupError extends Error {
  readonly kind: PushError
  constructor(kind: PushError, message: string) {
    super(message)
    this.kind = kind
  }
}

/** Identité de l'admin connecté : un jeton stocké pour un autre admin est ignoré. */
function currentUid(): string | null {
  try { return useAuthStore().user?.id ?? null } catch { return null }
}
function readToken(): string | null {
  const uid = currentUid()
  if (!uid) return null
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { uid?: unknown, token?: unknown }
    return parsed.uid === uid && typeof parsed.token === 'string' && parsed.token ? parsed.token : null
  } catch { return null }
}
function writeToken(token: string | null): void {
  try {
    const uid = currentUid()
    if (token && uid) localStorage.setItem(TOKEN_KEY, JSON.stringify({ uid, token }))
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* l'app marche sans stockage */ }
}

function httpStatus(e: unknown): number | undefined {
  const err = e as { statusCode?: number, status?: number, response?: { status?: number } } | null
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

const CONFIG_ERRORS = new Set([
  'messaging/missing-app-config-values', 'messaging/invalid-vapid-key', 'messaging/token-subscribe-failed',
  'messaging/invalid-sw-registration',
])
const PERMISSION_ERRORS = new Set(['messaging/permission-blocked', 'messaging/permission-default'])

/** Range une erreur d'activation : configuration (clé, projet, clé d'API), autorisation, ou autre. */
function classifyError(e: unknown): PushError {
  if (e instanceof PushSetupError) return e.kind
  const err = e as { code?: unknown, name?: unknown } | null
  const code = typeof err?.code === 'string' ? err.code : ''
  if (CONFIG_ERRORS.has(code)) return 'config'
  if (PERMISSION_ERRORS.has(code) || err?.name === 'NotAllowedError') return 'permission'
  return 'generic'
}

function isIos(): boolean {
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true
  // iPadOS en mode bureau se présente comme un Mac : seul l'écran tactile le trahit.
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1
}
function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  try { return !!window.matchMedia?.('(display-mode: standalone)').matches } catch { return false }
}

function firebaseApp(): FirebaseApp | null {
  return (useNuxtApp() as unknown as { $firebaseApp: FirebaseApp | null }).$firebaseApp
}

/**
 * Attend que la registration ait un service worker actif. `register()` rend la main avant
 * l'activation au premier abonnement, et getToken (avec une registration fournie) n'attend pas :
 * `pushManager.subscribe` échouerait faute de service worker actif. Au-delà de `timeoutMs`, échec.
 */
export function waitForActivation(registration: ServiceWorkerRegistration, timeoutMs = SW_ACTIVATION_TIMEOUT_MS): Promise<void> {
  if (registration.active) return Promise.resolve()
  const timeoutError = () => new PushSetupError('generic', 'service worker not activated in time')
  const incoming = registration.installing ?? registration.waiting
  if (!incoming) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(timeoutError()), timeoutMs) })
    return Promise.race([navigator.serviceWorker.ready.then(() => undefined), timeout]).finally(() => clearTimeout(timer))
  }
  return new Promise<void>((resolve, reject) => {
    const finish = (settle: () => void) => {
      clearTimeout(timer)
      incoming.removeEventListener('statechange', onChange)
      settle()
    }
    function onChange(): void {
      if (incoming!.state === 'activated') finish(resolve)
      else if (incoming!.state === 'redundant') finish(() => reject(new PushSetupError('generic', 'service worker redundant')))
    }
    const timer = setTimeout(() => finish(() => reject(timeoutError())), timeoutMs)
    incoming.addEventListener('statechange', onChange)
    onChange()
  })
}

/**
 * Désinscription locale de l'abonnement push de l'app mobile (meilleur effort, ne lève jamais) :
 * `deleteToken` si ce document a obtenu le jeton, puis la souscription de la registration `/m/`.
 */
async function teardownLocalSubscription(base: string): Promise<void> {
  try {
    const app = firebaseApp()
    if (app) {
      const m = getMessaging(app)
      if (boundMessaging.has(m)) await deleteToken(m)
    }
  } catch { /* meilleur effort */ }
  try {
    const registration = await navigator.serviceWorker?.getRegistration(`${base}m/`)
    const subscription = await registration?.pushManager?.getSubscription()
    await subscription?.unsubscribe()
  } catch { /* meilleur effort */ }
}

function baseOf(baseURL: string | undefined): string {
  return (baseURL || '/').replace(/\/?$/, '/')
}

export function usePushSubscription(): {
  state: Ref<PushState>
  error: Ref<PushError | null>
  enable: () => Promise<void>
  disable: () => Promise<void>
  refresh: () => Promise<void>
} {
  const config = useRuntimeConfig()
  const pub = config.public as Record<string, unknown>
  const vapidKey = typeof pub.firebaseVapidKey === 'string' ? pub.firebaseVapidKey.trim() : ''
  // FCM refuse une app Firebase sans messagingSenderId : pas de push sans lui (comme sans clé VAPID).
  const senderId = resolveMessagingSenderId(pub)
  const base = baseOf(config.app.baseURL)

  function detect(): PushState {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'unsupported'
    // iOS n'expose les API push qu'une fois l'app installée : l'indice d'installation passe avant.
    if (isIos() && !isStandalone()) return 'needs-install'
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || typeof PushManager === 'undefined') return 'unsupported'
    if (!vapidKey || !senderId) return 'unsupported'
    if (Notification.permission === 'denied') return 'denied'
    return 'off'
  }

  // 'unsupported' des deux côtés (SSR et hydratation) : l'état réel est calculé par refresh() au montage.
  const state = ref<PushState>('unsupported')
  const error = ref<PushError | null>(null)

  function messaging(): Messaging {
    const app = firebaseApp()
    if (!app) throw new PushSetupError('config', 'firebase app unavailable')
    return getMessaging(app)
  }

  async function refresh(): Promise<void> {
    const base0 = detect()
    if (base0 !== 'off') { state.value = base0; return }
    state.value = Notification.permission === 'granted' && readToken() ? 'on' : 'off'
  }

  async function enable(): Promise<void> {
    error.value = null
    const detected = detect()
    if (detected === 'unsupported' || detected === 'needs-install') { state.value = detected; return }
    try {
      // Doit rester dans le geste de l'utilisateur : première instruction asynchrone.
      const permission = await Notification.requestPermission()
      if (permission === 'denied') { state.value = 'denied'; return }
      if (permission !== 'granted') { state.value = 'off'; return }

      // updateViaCache 'none' : le navigateur revalide toujours le script du service worker.
      const registration = await navigator.serviceWorker.register(`${base}m/firebase-messaging-sw.js`, { scope: `${base}m/`, updateViaCache: 'none' })
      await waitForActivation(registration)
      const m = messaging()
      const token = await getToken(m, { vapidKey, serviceWorkerRegistration: registration })
      boundMessaging.add(m)
      if (!token) throw new PushSetupError('generic', 'empty FCM token')
      await mobileService.registerDevice({
        fcmToken: token,
        deviceName: buildWebDeviceName(navigator.userAgent),
        platform: 'web',
      })
      writeToken(token)
      state.value = 'on'
    } catch (e) {
      const status = httpStatus(e)
      // Back-end pas encore déployé : fonction indisponible, pas une erreur.
      if (status === 404 || status === 405) { state.value = 'unsupported'; return }
      state.value = 'off'
      error.value = classifyError(e)
    }
  }

  async function disable(): Promise<void> {
    error.value = null
    const token = readToken()
    if (token) {
      try { await mobileService.unregisterDevice(token) } catch { /* on continue */ }
    }
    await teardownLocalSubscription(base)
    writeToken(null)
    state.value = detect() === 'denied' ? 'denied' : 'off'
  }

  return { state, error, enable, disable, refresh }
}

const LOGOUT_TEARDOWN_TIMEOUT_MS = 2000

/**
 * Révoque l'abonnement push de cet appareil à la déconnexion explicite (appelée AVANT la
 * déconnexion Firebase, les identifiants d'API sont encore valides). Meilleur effort : ne lève
 * jamais, no-op sans jeton ou côté serveur, attend au plus 2 s.
 */
export async function clearPushOnLogout(): Promise<void> {
  if (typeof window === 'undefined') return
  const token = readToken()
  if (!token) return
  const teardown = (async () => {
    try { await mobileService.unregisterDevice(token) } catch { /* meilleur effort */ }
    let base = '/'
    try { base = baseOf(useRuntimeConfig().app.baseURL) } catch { /* racine par défaut */ }
    await teardownLocalSubscription(base)
  })()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, LOGOUT_TEARDOWN_TIMEOUT_MS) })
  try { await Promise.race([teardown, timeout]) } catch { /* jamais bloquant */ }
  clearTimeout(timer)
  writeToken(null)
}
