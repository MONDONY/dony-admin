import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ACTIVITY_KEY, LOCKED_KEY, DEFAULT_IDLE_MS, FUTURE_TOLERANCE_MS, isActivityStale, readLastActivity, writeLastActivity,
  markLocked, readLockMarker, clearLockMarker, noteSignedIn, isMobileAppPath, appPathFromLocation,
  _resetLockStateMemory, isSafeAppPath, loginRedirectTarget, idleLoginRoute, sessionEndRoute, readLockContext,
  clearLockContext, LOCK_ROUTE, resolveIdleMinutes, resolveIdleMs, IDLE_MINUTES_DEFAULT, IDLE_MINUTES_MIN, IDLE_MINUTES_MAX,
} from '@/features/mobile/lib/lockState'
import { faultyStorage, restoreStorage } from '../../../helpers/storage'

const MIN = 60 * 1000

/** Stockage plein : l'écriture lève (QuotaExceededError), la lecture marche toujours. */
const quotaFull = () => faultyStorage({ set: true })

describe('lockState', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetLockStateMemory()
  })
  afterEach(() => { restoreStorage(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/') })

  it('isActivityStale: > 0 and at least the idle delay old', () => {
    const now = 1_000_000_000
    expect(isActivityStale(0, now)).toBe(false)
    expect(isActivityStale(now - 29 * MIN, now)).toBe(false)
    expect(isActivityStale(now - 30 * MIN, now)).toBe(true)
    expect(isActivityStale(now - 10_000, now, 5_000)).toBe(true)
    expect(DEFAULT_IDLE_MS).toBe(30 * MIN)
  })

  it('last activity round-trips through localStorage, garbage reads as 0', () => {
    expect(readLastActivity()).toBe(0)
    writeLastActivity(1234)
    expect(localStorage.getItem(ACTIVITY_KEY)).toBe('1234')
    expect(readLastActivity()).toBe(1234)
    // Nouveau document (sa mémoire ne connaît pas 1234) face à une valeur illisible.
    _resetLockStateMemory()
    localStorage.setItem(ACTIVITY_KEY, 'abc')
    expect(readLastActivity()).toBe(0)
  })

  it('last activity falls back to memory when storage throws', () => {
    const fake = faultyStorage({ get: true, set: true, remove: true })
    writeLastActivity(5678)
    expect(fake.data.has(ACTIVITY_KEY)).toBe(false)
    expect(readLastActivity()).toBe(5678)
  })

  it('lock marker: write, read with its reason, clear', () => {
    expect(readLockMarker()).toBeNull()
    markLocked('idle', 42)
    expect(JSON.parse(localStorage.getItem(LOCKED_KEY)!)).toEqual({ at: 42, reason: 'idle' })
    expect(readLockMarker()).toEqual({ at: 42, reason: 'idle' })
    clearLockMarker()
    expect(readLockMarker()).toBeNull()
  })

  it('a bare "1" marker still counts as set, without a reason', () => {
    localStorage.setItem(LOCKED_KEY, '1')
    expect(readLockMarker()).toEqual({ at: 0, reason: null })
  })

  it('lock marker falls back to memory when storage throws', () => {
    const fake = faultyStorage({ get: true, set: true, remove: true })
    markLocked('idle', 7)
    expect(fake.data.has(LOCKED_KEY)).toBe(false)
    expect(readLockMarker()).toEqual({ at: 7, reason: 'idle' })
    clearLockMarker()
    expect(readLockMarker()).toBeNull()
  })

  it('noteSignedIn clears the marker and stamps the activity', () => {
    markLocked('idle', 1)
    noteSignedIn(9999)
    expect(readLockMarker()).toBeNull()
    expect(readLastActivity()).toBe(9999)
  })

  it.each([
    ['/m', true], ['/m/', true], ['/m/alertes/abc', true], ['/m?x=1', true], ['/m#h', true],
    ['/mfa-setup', false], ['/', false], ['/login', false], ['/users', false], ['m/alertes', false],
  ])('isMobileAppPath(%s) = %s', (p, expected) => {
    expect(isMobileAppPath(p)).toBe(expected)
  })

  // ── Horloge et valeurs stockées douteuses ──────────────────────────────────

  it('an activity in the future beyond the tolerance (clock set back, tampering) is stale, never "fresh forever"', () => {
    const now = 1_000_000_000
    expect(FUTURE_TOLERANCE_MS).toBe(5 * MIN)
    expect(isActivityStale(now + 6 * MIN, now)).toBe(true)
    expect(isActivityStale(now + 365 * 24 * 60 * MIN, now)).toBe(true)
    // Petit décalage (resynchronisation de l'horloge) : toléré.
    expect(isActivityStale(now + 4 * MIN, now)).toBe(false)
    expect(isActivityStale(now + 5 * MIN, now)).toBe(false)
  })

  it('the boundary is inclusive: exactly the delay expires, one millisecond less does not', () => {
    const now = 1_000_000_000
    expect(isActivityStale(now - 10 * MIN, now, 10 * MIN)).toBe(true)
    expect(isActivityStale(now - 10 * MIN + 1, now, 10 * MIN)).toBe(false)
  })

  it('invalid activities count as "no activity" (never stale by themselves)', () => {
    const now = 1_000_000_000
    for (const v of [Number.NaN, -5, 0, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(isActivityStale(v, now)).toBe(false)
    }
  })

  it.each(['-5', 'NaN', 'Infinity', '', '   ', '12abc', '1.5', '0x10', '1e12', 'null'])(
    'stored activity %j reads as no activity (0)', (raw) => {
      localStorage.setItem(ACTIVITY_KEY, raw)
      expect(readLastActivity()).toBe(0)
    })

  // ── Stockage plein (setItem lève, getItem marche) ──────────────────────────

  it('quota full: a fresh activity wins over the stale stored value (max of storage and memory)', () => {
    const now = 1_000_000_000
    localStorage.setItem(ACTIVITY_KEY, String(now - 120 * MIN))
    quotaFull()
    writeLastActivity(now)
    expect(readLastActivity()).toBe(now)
    expect(isActivityStale(readLastActivity(), now)).toBe(false)
  })

  it('quota full: a newer activity written by another tab still wins over this page\'s memory', () => {
    const now = 1_000_000_000
    const fake = quotaFull()
    writeLastActivity(now - 10 * MIN)
    // L'autre onglet a réussi à écrire (place libérée entre-temps).
    fake.data.set(ACTIVITY_KEY, String(now - MIN))
    expect(readLastActivity()).toBe(now - MIN)
  })

  it('quota full: the stale stored activity is dropped, so the next page start does not see it', () => {
    const now = 1_000_000_000
    localStorage.setItem(ACTIVITY_KEY, String(now - 120 * MIN))
    const fake = quotaFull()
    writeLastActivity(now)
    expect(fake.data.has(ACTIVITY_KEY)).toBe(false)
    // Nouveau document (mémoire vide) : aucune activité connue, pas une activité périmée.
    _resetLockStateMemory()
    expect(readLastActivity()).toBe(0)
  })

  it('quota full: the lock marker set by this page is kept in memory and preferred', () => {
    localStorage.setItem(LOCKED_KEY, JSON.stringify({ at: 1, reason: null }))
    quotaFull()
    markLocked('idle', 42)
    expect(readLockMarker()).toEqual({ at: 42, reason: 'idle' })
  })

  it('quota full: sign-in clears the lock and the next check is not an immediate lock (no loop)', () => {
    const now = 1_000_000_000
    localStorage.setItem(ACTIVITY_KEY, String(now - 120 * MIN))
    localStorage.setItem(LOCKED_KEY, JSON.stringify({ at: now - 90 * MIN, reason: 'idle' }))
    quotaFull()
    noteSignedIn(now)
    expect(readLockMarker()).toBeNull()
    expect(isActivityStale(readLastActivity(), now)).toBe(false)
    expect(isActivityStale(readLastActivity(), now + 29 * MIN)).toBe(false)
  })

  it('a marker that cannot be removed is blanked instead, so it never outlives a sign-in', () => {
    localStorage.setItem(LOCKED_KEY, JSON.stringify({ at: 1, reason: 'idle' }))
    faultyStorage({ remove: true })
    clearLockMarker()
    _resetLockStateMemory()
    expect(readLockMarker()).toBeNull()
  })

  // ── Durée configurable (NUXT_PUBLIC_IDLE_LOCK_MINUTES) ─────────────────────

  it('bounds: 30 minutes by default, never below 5, never above 720 (12 h)', () => {
    expect([IDLE_MINUTES_DEFAULT, IDLE_MINUTES_MIN, IDLE_MINUTES_MAX]).toEqual([30, 5, 720])
  })

  it.each([
    [undefined], [null], [''], ['   '], ['abc'], ['30min'], [Number.NaN], ['NaN'],
    [Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY], [0], ['0'], [-1], ['-15'], [true], [{}], [[45]],
  ])('missing or invalid value %j: 30 minutes (the expiry can never be disabled)', (raw) => {
    expect(resolveIdleMinutes(raw)).toBe(30)
    expect(resolveIdleMs(raw)).toBe(30 * MIN)
  })

  it.each([
    [5, 5], [4, 5], [1, 5], [0.5, 5], ['3', 5],
    [45, 45], ['45', 45], [' 45 ', 45], [45.9, 45], ['10.5', 10],
    [720, 720], [721, 720], [100000, 720], ['1e3', 720],
  ])('%j minutes resolves to %i (clamped, whole minutes)', (raw, minutes) => {
    expect(resolveIdleMinutes(raw)).toBe(minutes)
    expect(resolveIdleMs(raw)).toBe(minutes * MIN)
  })

  it('appPathFromLocation strips the base URL and keeps query and hash', () => {
    window.history.replaceState(null, '', '/siragbe/m/alertes/abc?x=1#top')
    expect(appPathFromLocation('/siragbe/')).toBe('/m/alertes/abc?x=1#top')
    expect(appPathFromLocation('/siragbe')).toBe('/m/alertes/abc?x=1#top')
    window.history.replaceState(null, '', '/other/m')
    expect(appPathFromLocation('/siragbe/')).toBe('/other/m')
    expect(appPathFromLocation(undefined)).toBe('/other/m')
  })
})

// Retour après la connexion du bureau (`/login?redirect=`) : chemins de l'appli seulement.
describe('desktop return path after sign-in', () => {
  it.each(['/transactions?x=1', '/', '/users/abc-123', '/alertes?item=REPORT:0b2f', '/m/alertes'])(
    'accepts %s', (p) => {
      expect(isSafeAppPath(p)).toBe(true)
      expect(loginRedirectTarget(p)).toBe(p)
    })

  it.each([
    '//evil.test', '//evil.test/x', 'https://evil.test', 'http:evil.test', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)',
    '/\\evil.test', '\\\\evil.test', '/users\\x', '/%2F%2Fevil.test', '/%2fevil', '/%5Cevil', '/users/%2F',
    '/a/../..//evil', '/a/..', '/a/%2e%2e/b', '/a/%2E%2e/b', '/./x', '/users//x', '/x\ny', '/x\ty', 'transactions',
    '', '/login', '/login?redirect=%2Fx', '/m/verrouille', null, undefined, 42, ['/x'], {},
    // vue-router compare les chemins sans tenir compte de la casse : /LOGIN est la page de connexion.
    '/LOGIN', '/Login?x=1', '/login/', '/M/VERROUILLE', '/m/Verrouille?x=1',
  ])('rejects %j (falls back to /)', (p) => {
    expect(loginRedirectTarget(p)).toBe('/')
  })

  it('idleLoginRoute keeps the page left as an encoded redirect, never a trivial or unsafe one', () => {
    expect(idleLoginRoute('/transactions?x=1')).toBe('/login?redirect=%2Ftransactions%3Fx%3D1')
    expect(idleLoginRoute('/users/abc')).toBe('/login?redirect=%2Fusers%2Fabc')
    expect(idleLoginRoute('/')).toBe('/login')
    expect(idleLoginRoute('//evil.test')).toBe('/login')
    expect(idleLoginRoute('/login?redirect=%2Fx')).toBe('/login')
    expect(idleLoginRoute('/Login?x')).toBe('/login')
  })
})

// Session disparue (déconnexion Firebase vue par un onglet) : où aller.
describe('sessionEndRoute', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); _resetLockStateMemory(); clearLockContext() })

  it('desktop page, no idle lock (session ended elsewhere, 401): plain /login', () => {
    expect(sessionEndRoute('/transactions?x=1')).toBe('/login')
    localStorage.setItem(LOCKED_KEY, '1')
    expect(sessionEndRoute('/transactions?x=1')).toBe('/login')
  })

  it('desktop page closed by an idle lock (this tab or another): /login remembering the page, like the lock', () => {
    markLocked('idle')
    expect(sessionEndRoute('/transactions?x=1')).toBe(idleLoginRoute('/transactions?x=1'))
    expect(sessionEndRoute('/transactions?x=1')).toBe('/login?redirect=%2Ftransactions%3Fx%3D1')
    expect(sessionEndRoute('//evil.test')).toBe('/login')
  })

  it('/m page: the lock page and the page remembered, idle lock or not', () => {
    markLocked('idle')
    expect(sessionEndRoute('/m/alertes/abc')).toBe(LOCK_ROUTE)
    expect(readLockContext().path).toBe('/m/alertes/abc')
  })
})
