import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { AdminUser } from '@/stores/auth'

const apiMock = vi.fn()
const fbSignInMock = vi.fn()
const fbSignOutMock = vi.fn()

vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: {} }))
vi.stubGlobal('navigateTo', vi.fn())

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...a: unknown[]) => fbSignInMock(...a),
  signOut: (...a: unknown[]) => fbSignOutMock(...a),
}))
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

const fakeAdmin: AdminUser = {
  id: '1', email: 'admin@yadony.com', role: 'ADMIN', status: 'ACTIVE',
  mustChangePassword: false, permissionOverrides: {},
}

describe('useFirebaseAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiMock.mockReset()
    fbSignInMock.mockReset()
    fbSignOutMock.mockReset()
  })

  it('signs in with the exact email', async () => {
    fbSignInMock.mockResolvedValue({ user: { getIdToken: () => Promise.resolve('tok-123') } })
    apiMock.mockResolvedValue(fakeAdmin)

    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await useFirebaseAuth().signIn('Admin@Yadony.com', 'pass12345678')

    expect(fbSignInMock).toHaveBeenCalledWith({}, 'admin@yadony.com', 'pass12345678')
  })

  it('signIn authenticates and sets session', async () => {
    const getIdTokenMock = vi.fn(() => Promise.resolve('tok-123'))
    fbSignInMock.mockResolvedValue({ user: { getIdToken: getIdTokenMock } })
    apiMock.mockResolvedValue(fakeAdmin)

    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    const fb = useFirebaseAuth()
    const result = await fb.signIn(' admin@yadony.com ', 'pass123')

    expect(getIdTokenMock).toHaveBeenCalledWith(true)
    expect(result).toMatchObject({ id: '1', role: 'ADMIN' })
    expect(useAuthStore().isAuthenticated).toBe(true)
    expect(useAuthStore().idToken).toBe('tok-123')
  })

  it('signOut calls firebase signOut and clears the auth store', async () => {
    fbSignOutMock.mockResolvedValue(undefined)
    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    const fb = useFirebaseAuth()

    useAuthStore().setSession('token-123', fakeAdmin)
    expect(useAuthStore().isAuthenticated).toBe(true)

    await fb.signOut()

    expect(fbSignOutMock).toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('refreshProfile fetches /admin/me and updates the session', async () => {
    apiMock.mockResolvedValue(fakeAdmin)
    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    const fb = useFirebaseAuth()

    const result = await fb.refreshProfile('fresh-token')

    expect(apiMock).toHaveBeenCalledWith('/admin/me')
    expect(result).toEqual(fakeAdmin)
    expect(useAuthStore().isAuthenticated).toBe(true)
    expect(useAuthStore().idToken).toBe('fresh-token')
  })
})
