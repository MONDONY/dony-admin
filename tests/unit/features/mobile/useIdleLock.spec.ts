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
import { _resetLockStateMemory } from '@/features/mobile/lib/lockState'
import { useAuthStore } from '@/stores/auth'

const MIN = 60 * 1000
const STORAGE_KEY = 'yadony-admin-last-activity'
const LOCKED_KEY = 'yadony-admin-locked'

const mounted: Array<{ unmount: () => void }> = []
function mount(c: typeof Comp) {
  const w = vtuMount(c)
  mounted.push(w)
  return w
}

let api: ReturnType<typeof useIdleLock>
const Comp = defineComponent({
  props: { idleMs: { type: Number, default: undefined } },
  setup(props) {
    api = useIdleLock(props.idleMs ? { idleMs: props.idleMs } : undefined)
    return () => h('div')
  },
})

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

  it('throttles storage writes to once per 5 seconds', async () => {
    mount(Comp)
    const t0 = Date.now()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0))
    await vi.advanceTimersByTimeAsync(1000)
    window.dispatchEvent(new Event('pointerdown'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0))
    expect(api.lastActivityAt.value).toBe(t0 + 1000)
    await vi.advanceTimersByTimeAsync(5000)
    window.dispatchEvent(new Event('pointerdown'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(t0 + 6000))
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

describe('isSafeReturnPath', () => {
  it.each(['/m', '/m/alertes', '/m/alertes?item=A:B', '/m?x=1', '/m#h'])('accepts %s', (p) => {
    expect(isSafeReturnPath(p)).toBe(true)
  })
  it.each(['//evil.test', 'https://evil.test', '/login', 'javascript:alert(1)', '/mx', '/m/verrouille', '/m\\evil', '/m/..//evil', '/m/../login', '/m/%2F%2Fevil', '/m/%2fevil', '/m/%5Cevil', '/m//x', '', null, undefined, 42, '/m/\nx'])('rejects %s', (p) => {
    expect(isSafeReturnPath(p as string)).toBe(false)
  })
})
