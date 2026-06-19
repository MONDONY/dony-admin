import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const apiMock = vi.fn()
const fbSignOut = vi.fn()

vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: {} }))
vi.stubGlobal('navigateTo', vi.fn())

vi.mock('firebase/auth', () => ({
  RecaptchaVerifier: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  signOut: (...a: unknown[]) => fbSignOut(...a),
}))
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
vi.mock('@/composables/useDeviceRegistration', () => ({ registerWebDevice: vi.fn() }))

describe('useFirebaseAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiMock.mockReset()
    fbSignOut.mockReset()
  })

  it('signOut calls firebase signOut and clears the auth store', async () => {
    fbSignOut.mockResolvedValue(undefined)
    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    const fb = useFirebaseAuth()

    // Seed authenticated state
    const store = useAuthStore()
    store.setSession('token-123', {
      id: '1',
      phoneNumber: '+33600000000',
      displayName: 'Admin',
      isProAccount: false,
      roles: ['ADMIN'],
      avatarUrl: null,
    })
    expect(store.isAuthenticated).toBe(true)

    await fb.signOut()

    expect(fbSignOut).toHaveBeenCalled()
    expect(store.isAuthenticated).toBe(false)
  })

  it('confirmOtp throws when sendOtp has not been called first', async () => {
    // Module-level `confirmation` starts as null; calling confirmOtp without sendOtp must throw
    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    const fb = useFirebaseAuth()

    // Reset module state by calling signOut (sets confirmation = null)
    fbSignOut.mockResolvedValue(undefined)
    await fb.signOut()

    await expect(fb.confirmOtp('123456')).rejects.toThrow("OTP non envoyé")
  })
})
