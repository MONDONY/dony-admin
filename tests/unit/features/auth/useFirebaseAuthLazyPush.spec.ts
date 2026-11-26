import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setActivePinia, createPinia } from 'pinia'

// Le module push (firebase/messaging) ne doit pas entrer dans le bundle du bureau : useFirebaseAuth
// ne le charge qu'à la déconnexion, et seulement si un jeton push est enregistré sur l'appareil.

const order: string[] = []
const loaded = { count: 0 }
const clearPushOnLogout = vi.fn(async () => { order.push('clearPush') })
const fbSignOutMock = vi.fn(async () => { order.push('firebaseSignOut') })

vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: { currentUser: null } }))
vi.stubGlobal('navigateTo', vi.fn())
vi.mock('firebase/auth', () => ({
  signOut: () => fbSignOutMock(),
  multiFactor: vi.fn(), getMultiFactorResolver: vi.fn(), signInWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(), TotpMultiFactorGenerator: { FACTOR_ID: 'totp' },
}))
vi.mock('@/composables/useApi', () => ({ useApi: () => vi.fn() }))
vi.mock('@/features/mobile/composables/usePushSubscription', () => {
  loaded.count++
  return { clearPushOnLogout: () => clearPushOnLogout() }
})

const KEY = 'yadony-admin-push-token'

describe('useFirebaseAuth loads the push module lazily', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    loaded.count = 0
    order.length = 0
    clearPushOnLogout.mockClear()
    fbSignOutMock.mockClear()
    localStorage.clear()
  })

  it('has no static import of the push composable (firebase/messaging out of the desktop bundle)', () => {
    const src = readFileSync(resolve(process.cwd(), 'app/features/auth/composables/useFirebaseAuth.ts'), 'utf8')
    expect(src).not.toMatch(/^import[^\n]*usePushSubscription/m)
    expect(src).not.toMatch(/^import[^\n]*firebase\/messaging/m)
  })

  it('without a stored push token: never loads the push module, signs out', async () => {
    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await useFirebaseAuth().signOut()
    expect(loaded.count).toBe(0)
    expect(clearPushOnLogout).not.toHaveBeenCalled()
    expect(fbSignOutMock).toHaveBeenCalledTimes(1)
  })

  it('with a stored push token: loads it, revokes the push, then signs out', async () => {
    localStorage.setItem(KEY, JSON.stringify({ uid: 'admin-1', token: 'tok-1' }))
    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await useFirebaseAuth().signOut()
    expect(loaded.count).toBe(1)
    expect(order).toEqual(['clearPush', 'firebaseSignOut'])
  })

  it('revokePush: false never loads the push module, even with a token', async () => {
    localStorage.setItem(KEY, JSON.stringify({ uid: 'admin-1', token: 'tok-1' }))
    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await useFirebaseAuth().signOut({ revokePush: false })
    expect(loaded.count).toBe(0)
    expect(fbSignOutMock).toHaveBeenCalledTimes(1)
  })

  it('a failing push teardown never blocks the sign-out', async () => {
    localStorage.setItem(KEY, 'x')
    clearPushOnLogout.mockRejectedValueOnce(new Error('chunk load failed'))
    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await useFirebaseAuth().signOut()
    expect(fbSignOutMock).toHaveBeenCalledTimes(1)
  })

  it('unreadable storage: no push module, sign-out still happens', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    try {
      const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
      await useFirebaseAuth().signOut()
      expect(loaded.count).toBe(0)
      expect(fbSignOutMock).toHaveBeenCalledTimes(1)
    } finally { spy.mockRestore() }
  })
})
