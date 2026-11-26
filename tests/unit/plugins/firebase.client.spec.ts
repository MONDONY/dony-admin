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
  } as Record<string, string>,
}
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('navigateTo', navigateMock)
vi.stubGlobal('useRuntimeConfig', () => config)

import plugin from '@/plugins/firebase.client'
import { useAuthStore } from '@/stores/auth'
import { ACTIVITY_KEY, LOCKED_KEY, clearLockContext, readLockMarker } from '@/features/mobile/lib/lockState'

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
    localStorage.clear()
    sessionStorage.clear()
    clearLockContext()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-26T10:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); at('/') })

  it('restores the session on a desktop page (unchanged behaviour)', async () => {
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

  it('same stale activity on a desktop path: session restored (no expiry on desktop)', async () => {
    at('/siragbe/users')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 120 * MIN))
    await run()
    expect(h.fbSignOut).not.toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('/mfa-setup is not the mobile section even though it starts with /m', async () => {
    at('/siragbe/mfa-setup')
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 120 * MIN))
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
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
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
})
