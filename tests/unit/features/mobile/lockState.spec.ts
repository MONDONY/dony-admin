import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ACTIVITY_KEY, LOCKED_KEY, DEFAULT_IDLE_MS, FUTURE_TOLERANCE_MS, isActivityStale, readLastActivity, writeLastActivity,
  markLocked, readLockMarker, clearLockMarker, noteSignedIn, isMobileAppPath, appPathFromLocation,
  _resetLockStateMemory,
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

  it('appPathFromLocation strips the base URL and keeps query and hash', () => {
    window.history.replaceState(null, '', '/siragbe/m/alertes/abc?x=1#top')
    expect(appPathFromLocation('/siragbe/')).toBe('/m/alertes/abc?x=1#top')
    expect(appPathFromLocation('/siragbe')).toBe('/m/alertes/abc?x=1#top')
    window.history.replaceState(null, '', '/other/m')
    expect(appPathFromLocation('/siragbe/')).toBe('/other/m')
    expect(appPathFromLocation(undefined)).toBe('/other/m')
  })
})
