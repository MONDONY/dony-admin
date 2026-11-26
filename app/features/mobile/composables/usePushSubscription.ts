import { ref, type Ref } from 'vue'
import { getMessaging, getToken, deleteToken } from 'firebase/messaging'
import type { FirebaseApp } from 'firebase/app'
import { mobileService } from '@/features/mobile/services/mobileService'
import { buildWebDeviceName } from '@/composables/useDeviceRegistration'
import { useAuthStore } from '@/stores/auth'
import { resolveMessagingSenderId } from '@/lib/firebaseConfig'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const TOKEN_KEY = 'yadony-admin-push-token'

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

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}
function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  try { return !!window.matchMedia?.('(display-mode: standalone)').matches } catch { return false }
}

export function usePushSubscription(): {
  state: Ref<PushState>
  enable: () => Promise<void>
  disable: () => Promise<void>
  refresh: () => Promise<void>
} {
  const config = useRuntimeConfig()
  const pub = config.public as Record<string, unknown>
  const vapidKey = typeof pub.firebaseVapidKey === 'string' ? pub.firebaseVapidKey.trim() : ''
  // FCM refuse une app Firebase sans messagingSenderId : pas de push sans lui (comme sans clé VAPID).
  const senderId = resolveMessagingSenderId(pub)
  const base = config.app.baseURL.replace(/\/?$/, '/')

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

  function messaging() {
    const app = (useNuxtApp() as unknown as { $firebaseApp: FirebaseApp | null }).$firebaseApp
    if (!app) throw new Error('firebase app unavailable')
    return getMessaging(app)
  }

  async function refresh(): Promise<void> {
    const base0 = detect()
    if (base0 !== 'off') { state.value = base0; return }
    state.value = Notification.permission === 'granted' && readToken() ? 'on' : 'off'
  }

  async function enable(): Promise<void> {
    const detected = detect()
    if (detected === 'unsupported' || detected === 'needs-install') { state.value = detected; return }
    try {
      // Doit rester dans le geste de l'utilisateur : première instruction asynchrone.
      const permission = await Notification.requestPermission()
      if (permission === 'denied') { state.value = 'denied'; return }
      if (permission !== 'granted') { state.value = 'off'; return }

      const registration = await navigator.serviceWorker.register(`${base}m/firebase-messaging-sw.js`, { scope: `${base}m/` })
      const token = await getToken(messaging(), { vapidKey, serviceWorkerRegistration: registration })
      if (!token) { state.value = 'off'; return }
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
      state.value = status === 404 || status === 405 ? 'unsupported' : 'off'
    }
  }

  async function disable(): Promise<void> {
    const token = readToken()
    if (token) {
      try { await mobileService.unregisterDevice(token) } catch { /* on continue */ }
    }
    try { await deleteToken(messaging()) } catch { /* on continue */ }
    writeToken(null)
    state.value = detect() === 'denied' ? 'denied' : 'off'
  }

  return { state, enable, disable, refresh }
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
    try {
      const app = (useNuxtApp() as unknown as { $firebaseApp: FirebaseApp | null }).$firebaseApp
      if (app) await deleteToken(getMessaging(app))
    } catch { /* meilleur effort */ }
  })()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, LOGOUT_TEARDOWN_TIMEOUT_MS) })
  try { await Promise.race([teardown, timeout]) } catch { /* jamais bloquant */ }
  clearTimeout(timer)
  writeToken(null)
}
