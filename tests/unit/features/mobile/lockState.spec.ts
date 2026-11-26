import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ACTIVITY_KEY, LOCKED_KEY, DEFAULT_IDLE_MS, isActivityStale, readLastActivity, writeLastActivity,
  markLocked, readLockMarker, clearLockMarker, noteSignedIn, isMobileAppPath, appPathFromLocation,
} from '@/features/mobile/lib/lockState'

const MIN = 60 * 1000

describe('lockState', () => {
  beforeEach(() => {
    localStorage.clear()
    clearLockMarker()
  })
  afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, '', '/') })

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
    localStorage.setItem(ACTIVITY_KEY, 'abc')
    expect(readLastActivity()).toBe(0)
  })

  it('last activity falls back to memory when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    writeLastActivity(5678)
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
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied') })
    markLocked('idle', 7)
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

  it('appPathFromLocation strips the base URL and keeps query and hash', () => {
    window.history.replaceState(null, '', '/siragbe/m/alertes/abc?x=1#top')
    expect(appPathFromLocation('/siragbe/')).toBe('/m/alertes/abc?x=1#top')
    expect(appPathFromLocation('/siragbe')).toBe('/m/alertes/abc?x=1#top')
    window.history.replaceState(null, '', '/other/m')
    expect(appPathFromLocation('/siragbe/')).toBe('/other/m')
    expect(appPathFromLocation(undefined)).toBe('/other/m')
  })
})
