import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { AdminUser } from '@/stores/auth'

const apiMock = vi.fn()
const fbSignInMock = vi.fn()
const fbSignOutMock = vi.fn()
const getResolverMock = vi.fn()
const multiFactorMock = vi.fn()
const assertionForSignInMock = vi.fn()
const generateSecretMock = vi.fn()
const assertionForEnrollmentMock = vi.fn()
const sendVerificationMock = vi.fn()
const navigateToMock = vi.fn()
const firebaseAuth: { currentUser: unknown } = { currentUser: null }

vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: firebaseAuth }))
vi.stubGlobal('navigateTo', navigateToMock)

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...a: unknown[]) => fbSignInMock(...a),
  signOut: (...a: unknown[]) => fbSignOutMock(...a),
  getMultiFactorResolver: (...a: unknown[]) => getResolverMock(...a),
  multiFactor: (...a: unknown[]) => multiFactorMock(...a),
  sendEmailVerification: (...a: unknown[]) => sendVerificationMock(...a),
  TotpMultiFactorGenerator: {
    FACTOR_ID: 'totp',
    assertionForSignIn: (...a: unknown[]) => assertionForSignInMock(...a),
    generateSecret: (...a: unknown[]) => generateSecretMock(...a),
    assertionForEnrollment: (...a: unknown[]) => assertionForEnrollmentMock(...a),
  },
}))

/** Utilisateur Firebase avec ses facteurs inscrits ({@code multiFactor(user)}). */
function fbUser(factorIds: string[] = [], email = 'admin@yadony.com') {
  const user = { email, getIdToken: vi.fn(() => Promise.resolve('tok-123')) }
  multiFactorMock.mockImplementation(() => ({
    enrolledFactors: factorIds.map((factorId) => ({ factorId })),
    getSession: vi.fn(() => Promise.resolve('mfa-session')),
    enroll: vi.fn(() => Promise.resolve()),
  }))
  return user
}
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

const fakeAdmin: AdminUser = {
  id: '1', email: 'admin@yadony.com', role: 'ADMIN', status: 'ACTIVE',
  mustChangePassword: false, permissionOverrides: {},
}

describe('useFirebaseAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    for (const m of [apiMock, fbSignInMock, fbSignOutMock, getResolverMock, multiFactorMock,
      assertionForSignInMock, generateSecretMock, assertionForEnrollmentMock, sendVerificationMock,
      navigateToMock]) m.mockReset()
    multiFactorMock.mockImplementation(() => ({ enrolledFactors: [] }))
    firebaseAuth.currentUser = null
  })

  it('signs in with the exact email', async () => {
    fbSignInMock.mockResolvedValue({ user: { getIdToken: () => Promise.resolve('tok-123') } })
    apiMock.mockResolvedValue(fakeAdmin)

    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await useFirebaseAuth().signIn('Admin@Yadony.com', 'pass12345678')

    expect(fbSignInMock).toHaveBeenCalledWith(firebaseAuth, 'admin@yadony.com', 'pass12345678')
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

  // ── Double authentification (TOTP) ──────────────────────────────────────

  it('records that a password-only admin has no second factor yet', async () => {
    fbSignInMock.mockResolvedValue({ user: fbUser([]) })
    apiMock.mockResolvedValue(fakeAdmin)

    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await useFirebaseAuth().signIn('admin@yadony.com', 'pass')

    expect(useAuthStore().mfaEnrolled).toBe(false)
  })

  it('records an enrolled TOTP factor', async () => {
    fbSignInMock.mockResolvedValue({ user: fbUser(['totp']) })
    apiMock.mockResolvedValue(fakeAdmin)

    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await useFirebaseAuth().signIn('admin@yadony.com', 'pass')

    expect(useAuthStore().mfaEnrolled).toBe(true)
  })

  it('keeps the resolver when Firebase asks for the code, then completes with it', async () => {
    const mfaError = Object.assign(new Error('mfa'), { code: 'auth/multi-factor-auth-required' })
    fbSignInMock.mockRejectedValue(mfaError)
    const resolveSignIn = vi.fn(() => Promise.resolve({ user: fbUser(['totp']) }))
    getResolverMock.mockReturnValue({ hints: [{ factorId: 'totp', uid: 'factor-1' }], resolveSignIn })
    assertionForSignInMock.mockReturnValue('assertion')
    apiMock.mockResolvedValue(fakeAdmin)

    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    const fb = useFirebaseAuth()
    await expect(fb.signIn('admin@yadony.com', 'pass')).rejects.toMatchObject({ code: 'auth/multi-factor-auth-required' })
    expect(getResolverMock).toHaveBeenCalledWith(firebaseAuth, mfaError)

    const admin = await fb.completeTotpSignIn(' 123 456 ')

    expect(assertionForSignInMock).toHaveBeenCalledWith('factor-1', '123456')
    expect(resolveSignIn).toHaveBeenCalledWith('assertion')
    expect(admin).toEqual(fakeAdmin)
    expect(useAuthStore().isAuthenticated).toBe(true)
    expect(useAuthStore().mfaEnrolled).toBe(true)
  })

  it('refuses to complete a code sign-in without a pending challenge', async () => {
    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await expect(useFirebaseAuth().completeTotpSignIn('123456')).rejects.toThrow()
  })

  it('starts the enrollment with a QR code for the admin email', async () => {
    firebaseAuth.currentUser = fbUser([], 'root@yadony.test')
    const secret = { secretKey: 'ABCDEF', generateQrCodeUrl: vi.fn(() => 'otpauth://totp/x') }
    generateSecretMock.mockResolvedValue(secret)

    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    const enrollment = await useFirebaseAuth().startTotpEnrollment()

    expect(generateSecretMock).toHaveBeenCalledWith('mfa-session')
    expect(secret.generateQrCodeUrl).toHaveBeenCalledWith('root@yadony.test', 'Yadony Admin')
    expect(enrollment).toMatchObject({ secretKey: 'ABCDEF', qrCodeUrl: 'otpauth://totp/x' })
  })

  it('enrolls the factor, then signs out so the next session carries the code', async () => {
    const user = fbUser([])
    firebaseAuth.currentUser = user
    const enroll = vi.fn(() => Promise.resolve())
    multiFactorMock.mockImplementation(() => ({ enrolledFactors: [], enroll }))
    assertionForEnrollmentMock.mockReturnValue('enroll-assertion')
    fbSignOutMock.mockResolvedValue(undefined)
    useAuthStore().setSession('tok', fakeAdmin)

    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    const secret = { secretKey: 'ABCDEF' }
    await useFirebaseAuth().finishTotpEnrollment(secret as never, '654321')

    expect(assertionForEnrollmentMock).toHaveBeenCalledWith(secret, '654321')
    expect(enroll).toHaveBeenCalledWith('enroll-assertion', 'Appli d’authentification')
    expect(fbSignOutMock).toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(navigateToMock).toHaveBeenCalledWith('/login?mfa=enrolled')
  })

  it('sends the verification email of the signed-in admin', async () => {
    const user = fbUser([])
    firebaseAuth.currentUser = user
    sendVerificationMock.mockResolvedValue(undefined)

    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await useFirebaseAuth().sendVerificationEmail()

    expect(sendVerificationMock).toHaveBeenCalledWith(user)
  })

  it('refuses the enrollment when no admin is signed in', async () => {
    const { useFirebaseAuth } = await import('@/features/auth/composables/useFirebaseAuth')
    await expect(useFirebaseAuth().startTotpEnrollment()).rejects.toThrow()
  })
})
