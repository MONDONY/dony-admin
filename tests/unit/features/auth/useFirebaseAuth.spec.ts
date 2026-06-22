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
  id: '1', login: 'admin.1', role: 'ADMIN', status: 'ACTIVE',
  mustChangePassword: false, permissionOverrides: {},
}

describe('useFirebaseAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiMock.mockReset()
    fbSignInMock.mockReset()
    fbSignOutMock.mockReset()
  })

  it('signIn authenticates and sets session', async () => {
    fbSignInMock.mockResolvedValue({ user: { getIdToken: () => Promise.resolve('tok-123') } })
    apiMock.mockResolvedValue(fakeAdmin)

    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    const fb = useFirebaseAuth()
    const result = await fb.signIn('admin.1', 'pass123')

    expect(fbSignInMock).toHaveBeenCalledWith({}, 'admin.1@admin.dony.invalid', 'pass123')
    expect(result).toMatchObject({ id: '1', role: 'ADMIN' })
    expect(useAuthStore().isAuthenticated).toBe(true)
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
})
