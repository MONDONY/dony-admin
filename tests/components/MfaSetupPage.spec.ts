import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)

const startMock = vi.fn()
const finishMock = vi.fn()
const sendVerificationMock = vi.fn()
const signOutMock = vi.fn()
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({
    startTotpEnrollment: startMock,
    finishTotpEnrollment: finishMock,
    sendVerificationEmail: sendVerificationMock,
    signOut: signOutMock,
  }),
}))
vi.mock('@/components/ui/ThemeToggle.vue', () => ({
  default: { name: 'ThemeToggle', template: '<div />' },
}))

const secret = { secretKey: 'JBSWY3DPEHPK3PXP' }
const enrollment = { secret, secretKey: 'JBSWY3DPEHPK3PXP', qrCodeUrl: 'otpauth://totp/Yadony%20Admin:root@yadony.test?secret=JBSWY3DPEHPK3PXP' }

function firebaseError(code: string) {
  return Object.assign(new Error(code), { code })
}

async function mountSetup() {
  const mod = await import('@/pages/mfa-setup.vue')
  const wrapper = mount(mod.default)
  await flushPromises()
  return wrapper
}

describe('mfa-setup page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    for (const m of [startMock, finishMock, sendVerificationMock, signOutMock, navigateToMock]) m.mockReset()
  })

  it('shows the QR code and the key to type by hand', async () => {
    startMock.mockResolvedValue(enrollment)
    const wrapper = await mountSetup()

    const qr = wrapper.find('img[data-test="totp-qr"]')
    expect(qr.exists()).toBe(true)
    expect(qr.attributes('src')).toMatch(/^data:image\/svg\+xml/)
    expect(wrapper.text()).toContain('JBSW Y3DP EHPK 3PXP')
  })

  it('enrolls with the first code of the app', async () => {
    startMock.mockResolvedValue(enrollment)
    finishMock.mockResolvedValue(undefined)
    const wrapper = await mountSetup()

    await wrapper.find('input#totp-code').setValue('123 456')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(finishMock).toHaveBeenCalledWith(secret, '123 456')
  })

  it('explains a wrong code without leaving the page', async () => {
    startMock.mockResolvedValue(enrollment)
    finishMock.mockRejectedValue(firebaseError('auth/invalid-verification-code'))
    const wrapper = await mountSetup()

    await wrapper.find('input#totp-code').setValue('000000')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Code incorrect')
    expect(wrapper.find('img[data-test="totp-qr"]').exists()).toBe(true)
  })

  it('asks to verify the email first, and sends the link', async () => {
    startMock.mockRejectedValue(firebaseError('auth/unverified-email'))
    sendVerificationMock.mockResolvedValue(undefined)
    const wrapper = await mountSetup()

    expect(wrapper.text()).toContain('vérifier ton adresse e-mail')
    await wrapper.find('[data-test="send-verification"]').trigger('click')
    await flushPromises()
    expect(sendVerificationMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain('E-mail envoyé')
  })

  it('asks to sign in again when the session is too old', async () => {
    startMock.mockRejectedValue(firebaseError('auth/requires-recent-login'))
    const wrapper = await mountSetup()

    await wrapper.find('[data-test="sign-in-again"]').trigger('click')
    expect(signOutMock).toHaveBeenCalled()
  })

  it('lets the admin continue when TOTP is not enabled on this environment', async () => {
    startMock.mockRejectedValue(firebaseError('auth/operation-not-allowed'))
    const wrapper = await mountSetup()

    expect(wrapper.text()).toContain('pas disponible')
    await wrapper.find('[data-test="continue-without"]').trigger('click')
    await flushPromises()
    expect(useAuthStore().mfaUnavailable).toBe(true)
    expect(navigateToMock).toHaveBeenCalledWith('/')
  })
})
