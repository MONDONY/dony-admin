import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Démarrage à froid du plugin Firebase : restauration de session, verrou au relancement de l'app
// mobile, configuration Firebase (messagingSenderId) et redirection quand la session disparaît.

// Évalué au chargement du plugin (import statique, remonté) : à poser avant lui.
vi.hoisted(() => { vi.stubGlobal('defineNuxtPlugin', (fn: unknown) => fn) })

const h = vi.hoisted(() => ({
  user: null as null | { getIdToken: () => Promise<string> },
  listeners: [] as Array<(_u: unknown) => unknown>,
  fbSignOut: vi.fn(),
  initializeApp: vi.fn(),
}))

vi.mock('firebase/app', () => ({
  initializeApp: (...a: unknown[]) => h.initializeApp(...a),
  getApps: () => [],
}))
vi.mock('firebase/auth', () => ({
  getAuth: () => ({ signOut: () => h.fbSignOut() }),
  onAuthStateChanged: (_a: unknown, cb: (_u: unknown) => unknown) => {
    h.listeners.push(cb)
    // Le premier abonnement reçoit l'utilisateur restauré (IndexedDB), comme Firebase.
    if (h.listeners.length === 1) queueMicrotask(() => { void cb(h.user) })
    return () => {}
  },
}))
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({ hasTotpFactor: () => true }))

const fetchMock = vi.fn()
const navigateMock = vi.fn()
const config = {
  app: { baseURL: '/siragbe/' },
  public: {
    apiBaseUrl: 'http://api.test/api/v1',
    firebaseApiKey: 'key',
    firebaseAuthDomain: 'x.firebaseapp.com',
    firebaseProjectId: 'proj',
    firebaseAppId: '1:424242:web:abc',
    firebaseMessagingSenderId: '',
  } as Record<string, unknown>,
}
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('navigateTo', navigateMock)
vi.stubGlobal('useRuntimeConfig', () => config)

import plugin from '@/plugins/firebase.client'
import { useAuthStore } from '@/stores/auth'
import {
  ACTIVITY_KEY, LOCKED_KEY, LOCK_ROUTE, _resetLockStateMemory, clearLockContext, noteSignedIn, readLockContext,
  readLockMarker,
} from '@/features/mobile/lib/lockState'
import { faultyStorage, restoreStorage } from '../../helpers/storage'

const MIN = 60 * 1000
const run = plugin as unknown as () => Promise<{ provide: Record<string, unknown> }>
const admin = { id: 'a1', email: 'admin@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

function at(path: string) { window.history.replaceState(null, '', path) }

describe('firebase.client plugin, cold start', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.listeners.length = 0
    h.user = { getIdToken: vi.fn().mockResolvedValue('tok') }
    h.fbSignOut.mockReset().mockResolvedValue(undefined)
    h.initializeApp.mockReset().mockReturnValue({ name: '[DEFAULT]' })
    fetchMock.mockReset().mockResolvedValue(admin)
    navigateMock.mockReset()
    config.public.firebaseMessagingSenderId = ''
    config.public.firebaseAppId = '1:424242:web:abc'
    delete config.public.idleLockMinutes
    localStorage.clear()
    sessionStorage.clear()
    // Chaque cas est un nouveau démarrage : rien en mémoire d'un cas précédent.
    _resetLockStateMemory()
    clearLockContext()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-26T10:00:00Z'))
  })
  afterEach(() => { restoreStorage(); vi.useRealTimers(); vi.restoreAllMocks(); at('/') })

  it('restores the session on a desktop page without any stored activity (first start, deployment of the expiry)', async () => {
    at('/siragbe/users')
    await run()
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/v1/admin/me', { headers: { Authorization: 'Bearer tok' } })
    expect(useAuthStore().isAuthenticated).toBe(true)
    expect(h.fbSignOut).not.toHaveBeenCalled()
  })

  it('lock marker set: signs out, does not hydrate the store (everywhere, desktop included)', async () => {
    at('/siragbe/users')
    localStorage.setItem(LOCKED_KEY, JSON.stringify({ at: Date.now() - MIN, reason: 'idle' }))
    await run()
    expect(h.fbSignOut).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('lock marker set and sign-out failing: still no hydration (fail closed)', async () => {
    at('/siragbe/m/alertes')
    localStorage.setItem(LOCKED_KEY, '1')
    h.fbSignOut.mockRejectedValue(new Error('offline'))
    await expect(run()).resolves.toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('stale activity under /m (app relaunched after 2 h): signs out, no hydration, marks the idle lock', async () => {
    at('/siragbe/m/alertes/abc')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 120 * MIN))
    await run()
    expect(h.fbSignOut).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(readLockMarker()?.reason).toBe('idle')
  })

  it('activity exactly 30 minutes old under /m counts as stale', async () => {
    at('/siragbe/m')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 30 * MIN))
    await run()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ── Bureau : même expiration (Android : PWA tuée, Chrome rouvert sur /siragbe/) ─

  it('stale activity on a desktop page (app killed, Chrome opened on the console): signs out, no hydration, idle marker', async () => {
    at('/siragbe/')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 120 * MIN))
    await run()
    expect(h.fbSignOut).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(readLockMarker()?.reason).toBe('idle')
  })

  it('activity exactly at the delay on a desktop page counts as stale', async () => {
    at('/siragbe/transactions?x=1')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 30 * MIN))
    await run()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fresh activity on a desktop page: session restored', async () => {
    at('/siragbe/transactions')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 29 * MIN))
    await run()
    expect(h.fbSignOut).not.toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('configured duration applies on the desktop too (10 minutes)', async () => {
    config.public.idleLockMinutes = 10
    at('/siragbe/users')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 11 * MIN))
    await run()
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('an activity stored far in the future (clock set back, tampering) is stale, not "fresh forever"', async () => {
    at('/siragbe/users')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() + 24 * 60 * MIN))
    await run()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it.each(['-5', 'NaN', 'abc', '1.5'])('an invalid stored activity (%s) counts as none: session restored', async (raw) => {
    at('/siragbe/users')
    localStorage.setItem(ACTIVITY_KEY, raw)
    await run()
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('no flash of private content: the plugin resolves only after the stale session is signed out', async () => {
    at('/siragbe/messages')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 120 * MIN))
    let release: () => void = () => {}
    h.fbSignOut.mockImplementation(() => new Promise<void>((r) => { release = r }))
    let resolved = false
    const started = run().then(() => { resolved = true })
    await vi.waitFor(() => expect(h.fbSignOut).toHaveBeenCalled())
    await Promise.resolve()
    // Nuxt n'installe l'app (pages, layouts) qu'une fois tous les plugins résolus.
    expect(resolved).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    release()
    await started
    expect(resolved).toBe(true)
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it.each(['/siragbe/login', '/siragbe/change-password', '/siragbe/mfa-setup', '/siragbe/denied', '/siragbe/m/verrouille'])(
    'stale activity on %s: the old session is closed, and a new sign-in is not undone at the next start (no loop)', async (path) => {
      at(path)
      localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 120 * MIN))
      await run()
      expect(useAuthStore().isAuthenticated).toBe(false)
      // L'admin se connecte (mot de passe, code ou page de verrouillage : openSession -> noteSignedIn).
      noteSignedIn()
      setActivePinia(createPinia())
      h.listeners.length = 0
      h.fbSignOut.mockClear()
      _resetLockStateMemory()
      await run()
      expect(h.fbSignOut).not.toHaveBeenCalled()
      expect(useAuthStore().isAuthenticated).toBe(true)
    })

  it('configured duration (10 minutes): activity 10 minutes old under /m is stale', async () => {
    config.public.idleLockMinutes = 10
    at('/siragbe/m/alertes')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 10 * MIN))
    await run()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('configured duration (10 minutes): activity 9 minutes old under /m is fresh', async () => {
    config.public.idleLockMinutes = '10'
    at('/siragbe/m/alertes')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 9 * MIN))
    await run()
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('empty or invalid configured duration (unset GitHub variable): 30 minutes', async () => {
    config.public.idleLockMinutes = ''
    at('/siragbe/m/alertes')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 29 * MIN))
    await run()
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('fresh activity under /m: session restored', async () => {
    at('/siragbe/m/alertes')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 5 * MIN))
    await run()
    expect(h.fbSignOut).not.toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('no stored activity under /m (first launch): session restored', async () => {
    at('/siragbe/m/alertes')
    await run()
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('storage unavailable under /m: no crash, session restored (today\'s behaviour, the in-app timer still runs)', async () => {
    at('/siragbe/m/alertes')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 120 * MIN))
    faultyStorage({ get: true, set: true, remove: true })
    await expect(run()).resolves.toBeDefined()
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('no Firebase user: nothing to sign out, nothing hydrated', async () => {
    at('/siragbe/m/alertes')
    h.user = null
    localStorage.setItem(LOCKED_KEY, '1')
    await run()
    expect(h.fbSignOut).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ── F2 : configuration Firebase complète pour FCM ─────────────────────────

  it('passes messagingSenderId from NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', async () => {
    config.public.firebaseMessagingSenderId = '777'
    await run()
    expect(h.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ messagingSenderId: '777', projectId: 'proj', apiKey: 'key', appId: '1:424242:web:abc' }))
  })

  it('falls back to the project number inside the appId', async () => {
    await run()
    expect(h.initializeApp.mock.calls[0]![0]).toMatchObject({ messagingSenderId: '424242' })
  })

  it('omits messagingSenderId when neither value is available', async () => {
    config.public.firebaseAppId = 'not-a-firebase-app-id'
    await run()
    expect(h.initializeApp.mock.calls[0]![0].messagingSenderId).toBeUndefined()
  })

  // ── F5 : la session disparaît pendant l'utilisation ───────────────────────

  it('session lost on an /m page: goes to the lock page (never /login) and remembers the page', async () => {
    at('/siragbe/m/alertes/abc?x=1')
    await run()
    expect(useAuthStore().isAuthenticated).toBe(true)
    await h.listeners[1]!(null)
    expect(navigateMock).toHaveBeenCalledWith(LOCK_ROUTE)
    expect(navigateMock).not.toHaveBeenCalledWith('/login')
    expect(readLockContext().path).toBe('/m/alertes/abc?x=1')
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('idle lock in another tab: this desktop tab goes to /login and remembers its own page', async () => {
    at('/siragbe/transactions?x=1')
    await run()
    // L'autre onglet a posé le marqueur avant sa déconnexion ; Firebase prévient celui-ci.
    localStorage.setItem(LOCKED_KEY, JSON.stringify({ at: Date.now(), reason: 'idle' }))
    await h.listeners[1]!(null)
    expect(navigateMock).toHaveBeenCalledWith('/login?redirect=%2Ftransactions%3Fx%3D1')
    expect(navigateMock).not.toHaveBeenCalledWith('/login')
  })

  it('idle lock in another tab on an /m page: still the lock page', async () => {
    at('/siragbe/m/alertes/abc')
    await run()
    localStorage.setItem(LOCKED_KEY, JSON.stringify({ at: Date.now(), reason: 'idle' }))
    await h.listeners[1]!(null)
    expect(navigateMock).toHaveBeenCalledWith(LOCK_ROUTE)
  })

  it('session lost on a desktop page: still goes to /login', async () => {
    at('/siragbe/users')
    await run()
    await h.listeners[1]!(null)
    expect(navigateMock).toHaveBeenCalledWith('/login')
  })
})
