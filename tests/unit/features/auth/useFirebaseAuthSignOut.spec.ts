import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const order: string[] = []
const fbSignOutMock = vi.fn(() => { order.push('firebaseSignOut'); return Promise.resolve() })
const unregisterDevice = vi.fn()
const deleteToken = vi.fn()
const navigateToMock = vi.fn()
const firebaseAuth = { currentUser: null }

vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: firebaseAuth, $firebaseApp: { name: 'app' } }))
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('useRuntimeConfig', () => ({ app: { baseURL: '/siragbe/' }, public: {} }))
vi.mock('firebase/auth', () => ({
  signOut: () => fbSignOutMock(),
  multiFactor: vi.fn(), getMultiFactorResolver: vi.fn(), signInWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(), TotpMultiFactorGenerator: { FACTOR_ID: 'totp' },
}))
vi.mock('firebase/messaging', () => ({
  getMessaging: () => ({ fake: 'messaging' }),
  getToken: vi.fn(),
  deleteToken: (...a: unknown[]) => { order.push('deleteToken'); return deleteToken(...a) },
}))
vi.mock('@/features/mobile/services/mobileService', () => ({
  mobileService: { registerDevice: vi.fn(), unregisterDevice: (...a: unknown[]) => { order.push('unregister'); return unregisterDevice(...a) } },
}))
vi.mock('@/composables/useApi', () => ({ useApi: () => vi.fn() }))

import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'

const KEY = 'yadony-admin-push-token'

describe('useFirebaseAuth.signOut and push revocation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    order.length = 0
    vi.clearAllMocks()
    unregisterDevice.mockResolvedValue(undefined)
    deleteToken.mockResolvedValue(true)
    localStorage.clear()
    useAuthStore().user = { id: 'admin-1', email: 'a@b.c', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
    localStorage.setItem(KEY, JSON.stringify({ uid: 'admin-1', token: 'tok-1' }))
  })

  it('revokes the push first, then signs out of Firebase', async () => {
    await useFirebaseAuth().signOut()
    expect(unregisterDevice).toHaveBeenCalledWith('tok-1')
    expect(deleteToken).toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(order).toEqual(['unregister', 'deleteToken', 'firebaseSignOut'])
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('still signs out when the unregister call rejects', async () => {
    unregisterDevice.mockRejectedValue(new Error('net'))
    await useFirebaseAuth().signOut()
    expect(fbSignOutMock).toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('signOut({ revokePush: false }) leaves the push registration in place', async () => {
    await useFirebaseAuth().signOut({ revokePush: false })
    expect(unregisterDevice).not.toHaveBeenCalled()
    expect(deleteToken).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).not.toBeNull()
    expect(fbSignOutMock).toHaveBeenCalled()
  })

  it('signOut({ redirectTo }) goes there instead of /login (lock page, no /login flash)', async () => {
    await useFirebaseAuth().signOut({ revokePush: false, redirectTo: '/m/verrouille' })
    expect(navigateToMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith('/m/verrouille')
  })

  it('is unchanged when no token is stored', async () => {
    localStorage.clear()
    await useFirebaseAuth().signOut()
    expect(unregisterDevice).not.toHaveBeenCalled()
    expect(fbSignOutMock).toHaveBeenCalled()
  })

  it('empties the auth store even when the Firebase sign-out rejects, then rethrows', async () => {
    fbSignOutMock.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    await expect(useFirebaseAuth().signOut()).rejects.toThrow('offline')
    expect(useAuthStore().user).toBeNull()
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })
})
