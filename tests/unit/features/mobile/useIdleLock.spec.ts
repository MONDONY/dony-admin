import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount as vtuMount } from '@vue/test-utils'

const signOutMock = vi.fn()
const navigateMock = vi.fn()
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ signOut: signOutMock }),
}))
vi.stubGlobal('navigateTo', navigateMock)
const routeState: { path: string, fullPath: string, query: Record<string, string> } = {
  path: '/m/alertes', fullPath: '/m/alertes?item=A:B', query: {},
}
vi.stubGlobal('useRoute', () => routeState)
// Configuration publique de Nuxt (idleLockMinutes) ; vide = durée par défaut.
const runtimePublic: Record<string, unknown> = {}
vi.stubGlobal('useRuntimeConfig', () => ({ public: runtimePublic }))

import {
  useIdleLock, effectiveIdleMs, configuredIdleMinutes, LOCK_ROUTE, readLockContext, clearLockContext, isSafeReturnPath,
} from '@/features/mobile/composables/useIdleLock'
import { seedAuth } from '../../../helpers/auth'
import { faultyStorage, restoreStorage } from '../../../helpers/storage'
import { _resetLockStateMemory, noteSignedIn, readLockMarker } from '@/features/mobile/lib/lockState'
import { useAuthStore } from '@/stores/auth'

const MIN = 60 * 1000
const STORAGE_KEY = 'yadony-admin-last-activity'
const LOCKED_KEY = 'yadony-admin-locked'

const mounted: Array<{ unmount: () => void }> = []
function mount(c: typeof Comp, props: { idleMs?: number, warn?: boolean } = {}) {
  const w = vtuMount(c, { props })
  mounted.push(w)
  return w
}

let api: ReturnType<typeof useIdleLock>
const Comp = defineComponent({
  props: { idleMs: { type: Number, default: undefined }, warn: { type: Boolean, default: false } },
  setup(props) {
    api = useIdleLock({ idleMs: props.idleMs, warn: props.warn })
    return () => h('div')
  },
})

/** Page de la console de bureau (layout par défaut). */
function onDesktop(path = '/transactions', fullPath = '/transactions?x=1') {
  routeState.path = path
  routeState.fullPath = fullPath
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useIdleLock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-26T10:00:00Z'))
    signOutMock.mockReset().mockResolvedValue(undefined)
    navigateMock.mockReset()
    routeState.path = '/m/alertes'
    routeState.fullPath = '/m/alertes?item=A:B'
    routeState.query = {}
    for (const k of Object.keys(runtimePublic)) delete runtimePublic[k]
    localStorage.clear()
    sessionStorage.clear()
    _resetLockStateMemory()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    seedAuth('ADMIN')
  })
  afterEach(() => {
    mounted.splice(0).forEach(w => w.unmount())
    restoreStorage()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('locks_after30MinutesWithoutActivity', async () => {
    mount(Comp)
    await vi.advanceTimersByTimeAsync(30 * MIN - 1000)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith(LOCK_ROUTE)
  })

  it('activity_resetsTheTimer', async () => {
    mount(Comp)
    await vi.advanceTimersByTimeAsync(29 * MIN)
    window.dispatchEvent(new Event('pointerdown'))
    await vi.advanceTimersByTimeAsync(29 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2 * MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it.each(['keydown', 'touchstart', 'scroll'])('%s counts as activity', async (evt) => {
    mount(Comp)
    await vi.advanceTimersByTimeAsync(29 * MIN)
    window.dispatchEvent(new Event(evt))
    await vi.advanceTimersByTimeAsync(29 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('throttles storage writes to once per 5 seconds, the skipped input written at the end of the window', async () => {
    mount(Comp)
    const t0 = Date.now()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0))
    await vi.advanceTimersByTimeAsync(1000)
    window.dispatchEvent(new Event('pointerdown'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0))
    expect(api.lastActivityAt.value).toBe(t0 + 1000)
    await vi.advanceTimersByTimeAsync(3999)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0))
    // Fin de la fenêtre de 5 s : le geste sauté est écrit (les autres onglets le voient).
    await vi.advanceTimersByTimeAsync(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0 + 1000))
    // L'écriture différée compte : un geste 1 s plus tard attend la fenêtre suivante.
    await vi.advanceTimersByTimeAsync(1000)
    window.dispatchEvent(new Event('pointerdown'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0 + 1000))
    await vi.advanceTimersByTimeAsync(4000)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0 + 6000))
  })

  it('without a skipped input, no extra write at the end of the window', async () => {
    mount(Comp)
    const t0 = Date.now()
    // Témoin : une écriture inutile remplacerait cette valeur par t0.
    localStorage.setItem(STORAGE_KEY, String(t0 - 1000))
    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0 - 1000))
  })

  it('another tab never closes the shared session early: the last input reaches the storage', async () => {
    mount(Comp)
    const t0 = Date.now()
    await vi.advanceTimersByTimeAsync(2000)
    window.dispatchEvent(new Event('keydown'))
    // Sans écriture différée, le stockage garderait t0 : l'autre onglet fermerait 2 s trop tôt.
    await vi.advanceTimersByTimeAsync(5000)
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBe(t0 + 2000)
  })

  it('a pending write is flushed when the tab is hidden, and when the layout unmounts', async () => {
    const w = mount(Comp)
    const t0 = Date.now()
    await vi.advanceTimersByTimeAsync(1000)
    window.dispatchEvent(new Event('pointerdown'))
    setVisibility('hidden')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0 + 1000))
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(1000)
    window.dispatchEvent(new Event('pointerdown'))
    w.unmount()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0 + 2000))
  })

  it('the deferred write never moves the shared activity backwards (another tab wrote later)', async () => {
    mount(Comp)
    const t0 = Date.now()
    await vi.advanceTimersByTimeAsync(1000)
    window.dispatchEvent(new Event('pointerdown'))
    localStorage.setItem(STORAGE_KEY, String(t0 + 3000))
    await vi.advanceTimersByTimeAsync(4000)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0 + 3000))
  })

  it('no pending write after the session closed (a closed session is never extended)', async () => {
    mount(Comp)
    await vi.advanceTimersByTimeAsync(29 * MIN + 58 * 1000)
    window.dispatchEvent(new Event('pointerdown'))
    const stamped = localStorage.getItem(STORAGE_KEY)
    await api.lockNow()
    await vi.advanceTimersByTimeAsync(10 * 1000)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(stamped)
  })

  it('locks_onReturn_ifElapsedWhileHidden', async () => {
    mount(Comp)
    setVisibility('hidden')
    vi.setSystemTime(Date.now() + 31 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('does not lock on return when the delay has not elapsed', async () => {
    mount(Comp)
    setVisibility('hidden')
    vi.setSystemTime(Date.now() + 5 * MIN)
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('uses activity recorded by another tab (storage)', async () => {
    mount(Comp)
    await vi.advanceTimersByTimeAsync(29 * MIN)
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    await vi.advanceTimersByTimeAsync(2 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(29 * MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('/m: an input after the deadline (app resumed, timer late) goes to the lock page instead of extending', async () => {
    mount(Comp)
    vi.setSystemTime(Date.now() + 3 * 60 * MIN)
    window.dispatchEvent(new Event('touchstart'))
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).toHaveBeenCalledWith({ revokePush: false, redirectTo: LOCK_ROUTE })
  })

  it('lockNow_signsOutFirebase_withRevokePushFalse', async () => {
    mount(Comp)
    await api.lockNow()
    expect(signOutMock).toHaveBeenCalledWith({ revokePush: false, redirectTo: '/m/verrouille' })
    expect(navigateMock).toHaveBeenCalledWith('/m/verrouille')
    expect(navigateMock).not.toHaveBeenCalledWith('/login')
    expect(signOutMock.mock.invocationCallOrder[0]).toBeLessThan(navigateMock.mock.invocationCallOrder[0]!)
  })

  it('remembers the current page and the email for the return', async () => {
    mount(Comp)
    await api.lockNow()
    expect(readLockContext()).toEqual({ path: '/m/alertes?item=A:B', email: 'admin@yadony.com' })
    clearLockContext()
    expect(readLockContext()).toEqual({ path: null, email: null })
  })

  it('does not remember a non app-relative page', async () => {
    routeState.fullPath = '//evil.test/x'
    mount(Comp)
    await api.lockNow()
    expect(readLockContext().path).toBeNull()
  })

  it('lockNow_isIdempotent', async () => {
    let release: () => void = () => {}
    signOutMock.mockImplementation(() => new Promise<void>((r) => { release = r }))
    mount(Comp)
    const a = api.lockNow()
    const b = api.lockNow()
    release()
    await Promise.all([a, b])
    expect(signOutMock).toHaveBeenCalledTimes(1)
    // Une fois déconnecté, un nouveau déclencheur ne fait rien non plus.
    useAuthStore().clear()
    await api.lockNow()
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('storageUnavailable_stillLocksInMemory', async () => {
    const fake = faultyStorage({ get: true, set: true, remove: true })
    mount(Comp)
    expect(fake.data.size).toBe(0)
    window.dispatchEvent(new Event('pointerdown'))
    await vi.advanceTimersByTimeAsync(31 * MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith(LOCK_ROUTE)
  })

  it('noLock_whenNotSignedIn', async () => {
    useAuthStore().clear()
    mount(Comp)
    await vi.advanceTimersByTimeAsync(40 * MIN)
    await api.lockNow()
    expect(signOutMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('noLock_onTheLockPage', async () => {
    routeState.path = '/m/verrouille'
    mount(Comp)
    await vi.advanceTimersByTimeAsync(40 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('idleQueryParam_ignoredOutsideDev', async () => {
    routeState.query = { idle: '1000' }
    mount(Comp)
    await vi.advanceTimersByTimeAsync(5000)
    expect(signOutMock).not.toHaveBeenCalled()
    expect(effectiveIdleMs(undefined, '1000', false, undefined)).toBe(30 * MIN)
  })

  it('effectiveIdleMs honours ?idle only in dev, with a valid value, else the configured minutes', () => {
    expect(effectiveIdleMs(undefined, '10000', true, 45)).toBe(10000)
    expect(effectiveIdleMs(undefined, 'abc', true, undefined)).toBe(30 * MIN)
    expect(effectiveIdleMs(undefined, '-5', true, undefined)).toBe(30 * MIN)
    expect(effectiveIdleMs(5000, '10000', false, 45)).toBe(5000)
    expect(effectiveIdleMs(undefined, undefined, true, undefined)).toBe(30 * MIN)
    // Hors développement, `?idle` ne contourne jamais la configuration (ni ses bornes).
    expect(effectiveIdleMs(undefined, '1000', false, 45)).toBe(45 * MIN)
    expect(effectiveIdleMs(undefined, undefined, false, 2)).toBe(5 * MIN)
    expect(effectiveIdleMs(undefined, undefined, false, '')).toBe(30 * MIN)
  })

  it('uses the configured duration (runtimeConfig.public.idleLockMinutes)', async () => {
    runtimePublic.idleLockMinutes = 10
    expect(configuredIdleMinutes()).toBe(10)
    mount(Comp)
    await vi.advanceTimersByTimeAsync(10 * MIN - 1000)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('an invalid configured duration falls back to 30 minutes', async () => {
    runtimePublic.idleLockMinutes = 'abc'
    mount(Comp)
    await vi.advanceTimersByTimeAsync(29 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2 * MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('outside a Nuxt context (no runtime config), the duration is 30 minutes', () => {
    vi.stubGlobal('useRuntimeConfig', () => { throw new Error('nuxt instance unavailable') })
    try {
      expect(configuredIdleMinutes()).toBe(30)
    } finally {
      vi.stubGlobal('useRuntimeConfig', () => ({ public: runtimePublic }))
    }
  })

  it('listenersRemovedOnUnmount', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const rmSpy = vi.spyOn(window, 'removeEventListener')
    const docAdd = vi.spyOn(document, 'addEventListener')
    const docRm = vi.spyOn(document, 'removeEventListener')
    const w = mount(Comp)
    const added = addSpy.mock.calls.map(c => c[0])
    expect(added).toEqual(expect.arrayContaining(['pointerdown', 'keydown', 'touchstart', 'scroll']))
    expect(docAdd.mock.calls.map(c => c[0])).toContain('visibilitychange')
    w.unmount()
    for (const evt of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {
      expect(rmSpy.mock.calls.map(c => c[0])).toContain(evt)
    }
    expect(docRm.mock.calls.map(c => c[0])).toContain('visibilitychange')
    await vi.advanceTimersByTimeAsync(40 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('a failing sign-out still empties the auth store (fail closed), retries once and keeps the lock page', async () => {
    signOutMock.mockRejectedValue(new Error('network'))
    mount(Comp)
    expect(useAuthStore().isAuthenticated).toBe(true)
    await api.lockNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(signOutMock).toHaveBeenCalledTimes(2)
    expect(navigateMock).toHaveBeenLastCalledWith(LOCK_ROUTE)
  })

  it('pageshow from the bfcache locks when the delay elapsed, a plain pageshow does not', async () => {
    mount(Comp)
    vi.setSystemTime(Date.now() + 31 * MIN)
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }))
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).not.toHaveBeenCalled()
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }))
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  // ── Relancement de l'app (F1) ─────────────────────────────────────────────

  it('locks at mount when the stored last activity is 30 minutes old or more (app relaunched)', async () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() - 120 * MIN))
    mount(Comp)
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith(LOCK_ROUTE)
    // La vieille valeur n'a pas été écrasée par « maintenant » avant la comparaison.
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBe(Date.now() - 120 * MIN)
  })

  it('does not lock at mount with a fresh stored activity, and stamps now', async () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() - 5 * MIN))
    mount(Comp)
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(Date.now()))
  })

  it('lockNow writes the lock marker BEFORE signing out', async () => {
    let markerAtSignOut: string | null = null
    signOutMock.mockImplementation(async () => { markerAtSignOut = localStorage.getItem(LOCKED_KEY) })
    mount(Comp)
    await api.lockNow()
    expect(markerAtSignOut).not.toBeNull()
    expect(JSON.parse(markerAtSignOut!)).toEqual({ at: Date.now(), reason: 'idle' })
  })

  it('pageshow listener is removed on unmount', () => {
    const rm = vi.spyOn(window, 'removeEventListener')
    const w = mount(Comp)
    w.unmount()
    expect(rm.mock.calls.map(c => c[0])).toContain('pageshow')
  })
})

describe('useIdleLock on the desktop console', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-26T10:00:00Z'))
    signOutMock.mockReset().mockResolvedValue(undefined)
    navigateMock.mockReset()
    routeState.query = {}
    onDesktop()
    for (const k of Object.keys(runtimePublic)) delete runtimePublic[k]
    localStorage.clear()
    sessionStorage.clear()
    _resetLockStateMemory()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    seedAuth('ADMIN')
  })
  afterEach(() => {
    mounted.splice(0).forEach(w => w.unmount())
    document.body.innerHTML = ''
    restoreStorage()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('closes the session after the delay and goes to /login with the page as a safe return path', async () => {
    let markerAtSignOut: unknown = 'unset'
    signOutMock.mockImplementation(async () => { markerAtSignOut = readLockMarker() })
    mount(Comp)
    await vi.advanceTimersByTimeAsync(30 * MIN)
    const target = '/login?redirect=%2Ftransactions%3Fx%3D1'
    expect(signOutMock).toHaveBeenCalledWith({ revokePush: false, redirectTo: target })
    expect(navigateMock).toHaveBeenCalledWith(target)
    expect(navigateMock).not.toHaveBeenCalledWith(LOCK_ROUTE)
    // Marqueur posé AVANT la déconnexion, comme sous /m.
    expect(markerAtSignOut).toEqual({ at: Date.now(), reason: 'idle' })
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it.each([
    ['/', '/'], ['/users', '//evil.test/x'], ['/users', '/users\\x'], ['/users', '/users/%2F%2Fevil'],
  ])('an unsafe or trivial return path (%s, %s) goes to plain /login', async (path, fullPath) => {
    onDesktop(path, fullPath)
    mount(Comp)
    await api.lockNow()
    expect(signOutMock).toHaveBeenCalledWith({ revokePush: false, redirectTo: '/login' })
    expect(navigateMock).toHaveBeenLastCalledWith('/login')
  })

  it('does not remember a lock-page context for a desktop page', async () => {
    mount(Comp)
    await api.lockNow()
    expect(readLockContext()).toEqual({ path: null, email: null })
  })

  it('a failing sign-out still empties the store and goes to /login (fail closed)', async () => {
    signOutMock.mockRejectedValue(new Error('offline'))
    mount(Comp)
    await api.lockNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(navigateMock).toHaveBeenLastCalledWith('/login?redirect=%2Ftransactions%3Fx%3D1')
  })

  // ── Entrées comptées comme activité ───────────────────────────────────────

  it('scrolling inside a nested container counts (scroll does not bubble: capture listener)', async () => {
    const box = document.createElement('div')
    document.body.appendChild(box)
    mount(Comp)
    await vi.advanceTimersByTimeAsync(29 * MIN)
    box.dispatchEvent(new Event('scroll', { bubbles: false }))
    await vi.advanceTimersByTimeAsync(29 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2 * MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('typing counts, even when a component stops the key event', async () => {
    const field = document.createElement('input')
    field.addEventListener('keydown', e => e.stopPropagation())
    document.body.appendChild(field)
    mount(Comp)
    await vi.advanceTimersByTimeAsync(29 * MIN)
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    await vi.advanceTimersByTimeAsync(29 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it.each(['input', 'wheel', 'dragover', 'drop'])('%s counts as activity (paste, mouse wheel, file dragged from the system)', async (evt) => {
    const field = document.createElement('textarea')
    document.body.appendChild(field)
    mount(Comp)
    await vi.advanceTimersByTimeAsync(29 * MIN)
    field.dispatchEvent(new Event(evt, { bubbles: true }))
    await vi.advanceTimersByTimeAsync(29 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('wheel, dragover and drop are listened to in capture, passively (scrolling and drops stay smooth)', () => {
    const add = vi.spyOn(window, 'addEventListener')
    mount(Comp)
    for (const evt of ['wheel', 'dragover', 'drop', 'scroll', 'touchstart']) {
      const call = add.mock.calls.find(c => c[0] === evt)
      expect(call?.[2]).toEqual({ passive: true, capture: true })
    }
  })

  it('a hidden desktop tab is closed when the delay passes (no wait for its return)', async () => {
    mount(Comp)
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(30 * MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('a hidden /m tab still waits for its return, as before', async () => {
    routeState.path = '/m/alertes'
    routeState.fullPath = '/m/alertes'
    mount(Comp)
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(40 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).toHaveBeenCalledWith({ revokePush: false, redirectTo: LOCK_ROUTE })
  })

  // ── Avertissement 60 s avant ──────────────────────────────────────────────

  it('warns 60 seconds before the expiry, not before', async () => {
    mount(Comp, { warn: true })
    await vi.advanceTimersByTimeAsync(29 * MIN - 1000)
    expect(api.warning.value).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(api.warning.value).toBe(true)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(api.warning.value).toBe(false)
  })

  it('"Rester connecté" hides the warning, stamps the activity at once and restarts the delay', async () => {
    mount(Comp, { warn: true })
    await vi.advanceTimersByTimeAsync(29 * MIN + 30 * 1000)
    expect(api.warning.value).toBe(true)
    api.stayConnected()
    expect(api.warning.value).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(Date.now()))
    await vi.advanceTimersByTimeAsync(29 * MIN - 1000)
    expect(api.warning.value).toBe(false)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(api.warning.value).toBe(true)
  })

  it('any user activity also dismisses the warning', async () => {
    mount(Comp, { warn: true })
    await vi.advanceTimersByTimeAsync(29 * MIN + 10 * 1000)
    expect(api.warning.value).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(api.warning.value).toBe(false)
    await vi.advanceTimersByTimeAsync(2 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('activity in another tab (storage event) dismisses the warning of this tab', async () => {
    mount(Comp, { warn: true })
    await vi.advanceTimersByTimeAsync(29 * MIN + 10 * 1000)
    expect(api.warning.value).toBe(true)
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    expect(api.warning.value).toBe(false)
    await vi.advanceTimersByTimeAsync(2 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('with the shortest duration (5 minutes) the warning still comes 60 seconds before', async () => {
    runtimePublic.idleLockMinutes = 5
    mount(Comp, { warn: true })
    await vi.advanceTimersByTimeAsync(4 * MIN - 1000)
    expect(api.warning.value).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(api.warning.value).toBe(true)
    await vi.advanceTimersByTimeAsync(MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('back to the tab 30 seconds before the expiry: the warning shows at once', async () => {
    mount(Comp, { warn: true })
    setVisibility('hidden')
    vi.setSystemTime(Date.now() + 29 * MIN + 30 * 1000)
    setVisibility('visible')
    expect(api.warning.value).toBe(true)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(30 * 1000)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('without the warn option (mobile layout) no warning is ever shown', async () => {
    mount(Comp)
    await vi.advanceTimersByTimeAsync(29 * MIN + 30 * 1000)
    expect(api.warning.value).toBe(false)
  })

  // ── Inerte sans admin connecté ────────────────────────────────────────────

  it('inert when no admin is signed in: no stamp, no warning, no sign-out', async () => {
    useAuthStore().clear()
    mount(Comp, { warn: true })
    window.dispatchEvent(new Event('pointerdown'))
    await vi.advanceTimersByTimeAsync(40 * MIN)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(api.warning.value).toBe(false)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('signed out while mounted: timers and warning stop; signed in again: the delay restarts', async () => {
    mount(Comp, { warn: true })
    await vi.advanceTimersByTimeAsync(29 * MIN + 10 * 1000)
    expect(api.warning.value).toBe(true)
    useAuthStore().clear()
    await vi.advanceTimersByTimeAsync(0)
    expect(api.warning.value).toBe(false)
    await vi.advanceTimersByTimeAsync(10 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
    // Connexion pendant que le layout est monté : l'activité repart de maintenant, sans
    // comparer d'abord à l'ancienne valeur (sinon verrouillage juste après la connexion).
    seedAuthKeepingPinia()
    await vi.advanceTimersByTimeAsync(0)
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBe(Date.now())
    await vi.advanceTimersByTimeAsync(29 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  // ── Entrée après l'échéance (veille, page gelée, minuteur en retard) ──────

  it('an input after the deadline (sleep: clock +5 h, timer not run yet) closes the session instead of extending it', async () => {
    mount(Comp)
    await vi.advanceTimersByTimeAsync(10 * MIN)
    const stamped = localStorage.getItem(STORAGE_KEY)
    const before = api.lastActivityAt.value
    vi.setSystemTime(Date.now() + 5 * 60 * MIN)
    window.dispatchEvent(new Event('pointerdown'))
    // Pas d'horodatage : la session n'est pas prolongée, ni ici ni pour les autres onglets.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(stamped)
    expect(api.lastActivityAt.value).toBe(before)
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(signOutMock).toHaveBeenCalledWith({ revokePush: false, redirectTo: '/login?redirect=%2Ftransactions%3Fx%3D1' })
    // Le minuteur en retard qui finit par tourner ne refait rien.
    await vi.advanceTimersByTimeAsync(30 * MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('warning shown before the sleep: "Rester connecté" on wake closes the session instead of extending it', async () => {
    mount(Comp, { warn: true })
    await vi.advanceTimersByTimeAsync(29 * MIN + 10 * 1000)
    expect(api.warning.value).toBe(true)
    const stamped = localStorage.getItem(STORAGE_KEY)
    vi.setSystemTime(Date.now() + 5 * 60 * MIN)
    api.stayConnected()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(stamped)
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(api.warning.value).toBe(false)
  })

  it('the click that wakes an expired session never reaches the page (no action on the old session)', async () => {
    const action = vi.fn()
    const button = document.createElement('button')
    button.addEventListener('pointerdown', action)
    button.addEventListener('click', action)
    document.body.appendChild(button)
    mount(Comp)
    vi.setSystemTime(Date.now() + 5 * 60 * MIN)
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    button.dispatchEvent(click)
    expect(action).not.toHaveBeenCalled()
    expect(click.defaultPrevented).toBe(true)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('Enter pressed on wake is cancelled (no form submission with the old session)', () => {
    const field = document.createElement('input')
    const onKey = vi.fn()
    field.addEventListener('keydown', onKey)
    document.body.appendChild(field)
    mount(Comp)
    vi.setSystemTime(Date.now() + 5 * 60 * MIN)
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    field.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(onKey).not.toHaveBeenCalled()
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('normal activity just before the deadline still extends the session (and reaches the page)', async () => {
    const action = vi.fn()
    const button = document.createElement('button')
    button.addEventListener('click', action)
    document.body.appendChild(button)
    mount(Comp)
    await vi.advanceTimersByTimeAsync(30 * MIN - 1000)
    window.dispatchEvent(new Event('pointerdown'))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(action).toHaveBeenCalledTimes(1)
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBe(Date.now())
    await vi.advanceTimersByTimeAsync(29 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('old in-memory activity but fresh shared activity (another tab was active): the input does not lock', async () => {
    mount(Comp)
    const t0 = Date.now()
    vi.setSystemTime(t0 + 40 * MIN)
    // Un autre onglet a travaillé 20 minutes après le dernier geste de celui-ci.
    localStorage.setItem(STORAGE_KEY, String(t0 + 20 * MIN))
    window.dispatchEvent(new Event('pointerdown'))
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).not.toHaveBeenCalled()
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBe(t0 + 40 * MIN)
  })

  it('in-memory and shared activity both expired: the input locks', async () => {
    mount(Comp)
    const t0 = Date.now()
    vi.setSystemTime(t0 + 40 * MIN)
    localStorage.setItem(STORAGE_KEY, String(t0 + 2 * MIN))
    window.dispatchEvent(new Event('pointerdown'))
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0 + 2 * MIN))
  })

  it('the clock set back while running: the next input closes the session', async () => {
    mount(Comp)
    vi.setSystemTime(Date.now() - 60 * MIN)
    window.dispatchEvent(new Event('keydown'))
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  // ── Démarrage, horloge, stockage plein ────────────────────────────────────

  it('a stored activity far in the future (clock set back, tampering) locks at mount', async () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + 2 * 60 * MIN))
    mount(Comp)
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('the clock set back while running: the session closes instead of never expiring', async () => {
    mount(Comp)
    vi.setSystemTime(Date.now() - 60 * MIN)
    await vi.advanceTimersByTimeAsync(30 * MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('quota full: sign-in then layout mount does not lock at once (no loop)', async () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() - 120 * MIN))
    faultyStorage({ set: true })
    noteSignedIn()
    mount(Comp, { warn: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(29 * MIN - 1000)
    expect(signOutMock).not.toHaveBeenCalled()
    expect(api.warning.value).toBe(false)
  })
})

/** Reconnexion sans changer de Pinia (le composable garde la référence du store). */
function seedAuthKeepingPinia() {
  useAuthStore().setSession('test-token', {
    id: 'u1', email: 'admin@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {},
  })
}

describe('isSafeReturnPath', () => {
  it.each(['/m', '/m/alertes', '/m/alertes?item=A:B', '/m?x=1', '/m#h'])('accepts %s', (p) => {
    expect(isSafeReturnPath(p)).toBe(true)
  })
  it.each(['//evil.test', 'https://evil.test', '/login', 'javascript:alert(1)', '/mx', '/m/verrouille', '/m\\evil', '/m/..//evil', '/m/../login', '/m/%2F%2Fevil', '/m/%2fevil', '/m/%5Cevil', '/m//x', '', null, undefined, 42, '/m/\nx', '/m/%2E%2E/login', '/m/.%2e/login', '/m/./x'])('rejects %s', (p) => {
    expect(isSafeReturnPath(p as string)).toBe(false)
  })
})
