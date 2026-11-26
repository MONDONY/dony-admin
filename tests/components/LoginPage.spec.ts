import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.stubGlobal('definePageMeta', vi.fn())
const runtimePublic: Record<string, unknown> = { firebaseApiKey: 'key' }
vi.stubGlobal('useRuntimeConfig', () => ({ public: runtimePublic }))
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('import.meta', { dev: false })

const signInMock = vi.fn()
const completeTotpMock = vi.fn()
const cancelTotpMock = vi.fn()
let routeQuery: Record<string, unknown> = {}
vi.stubGlobal('useRoute', () => ({ query: routeQuery }))
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ signIn: signInMock, completeTotpSignIn: completeTotpMock, cancelTotpSignIn: cancelTotpMock }),
}))
vi.mock('@/components/ui/ThemeToggle.vue', () => ({
  default: { name: 'ThemeToggle', template: '<div />' },
}))

import { LOCKED_KEY, _resetLockStateMemory } from '@/features/mobile/lib/lockState'

async function mountLogin() {
  const mod = await import('@/pages/login.vue')
  return mount(mod.default)
}

describe('login page (email+password)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    signInMock.mockReset()
    completeTotpMock.mockReset()
    cancelTotpMock.mockReset()
    routeQuery = {}
    delete runtimePublic.idleLockMinutes
    localStorage.clear()
    _resetLockStateMemory()
    vi.mocked(vi.stubGlobal('navigateTo', vi.fn()))
  })

  async function signInDirectly(admin = { mustChangePassword: false }) {
    signInMock.mockResolvedValueOnce(admin)
    const nav = vi.fn()
    vi.stubGlobal('navigateTo', nav)
    const wrapper = await mountLogin()
    await wrapper.find('input#email').setValue('admin@yadony.com')
    await wrapper.find('input#password').setValue('pass123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    return { wrapper, nav }
  }

  // ── Retour à la page quittée (session fermée pour inactivité) ─────────────

  it('returns to the page given in ?redirect after sign-in', async () => {
    routeQuery = { redirect: '/transactions?x=1' }
    const { nav } = await signInDirectly()
    expect(nav).toHaveBeenCalledWith('/transactions?x=1')
  })

  it('returns to the ?redirect page after the TOTP step too', async () => {
    routeQuery = { redirect: '/users/abc' }
    completeTotpMock.mockResolvedValueOnce({ mustChangePassword: false })
    const nav = vi.fn()
    vi.stubGlobal('navigateTo', nav)
    const wrapper = await passwordStepThenCode()
    await wrapper.find('input#totp-code').setValue('123456')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(nav).toHaveBeenCalledWith('/users/abc')
  })

  it.each([
    ['//evil.test'], ['https://evil.test'], ['javascript:alert(1)'], ['/\\evil.test'], ['\\\\evil.test'],
    ['/%2F%2Fevil.test'], ['/%5Cevil'], ['/a/../..//evil'], ['/login'], [''], [['/x', '/y']],
  ])('an unsafe ?redirect (%j) goes home instead', async (bad) => {
    routeQuery = { redirect: bad }
    const { nav } = await signInDirectly()
    expect(nav).toHaveBeenCalledWith('/')
  })

  it('a forced password change still wins over ?redirect', async () => {
    routeQuery = { redirect: '/transactions' }
    const { nav } = await signInDirectly({ mustChangePassword: true })
    expect(nav).toHaveBeenCalledWith('/change-password')
  })

  it('session closed for inactivity: says so, with the configured duration', async () => {
    runtimePublic.idleLockMinutes = 45
    localStorage.setItem(LOCKED_KEY, JSON.stringify({ at: 1, reason: 'idle' }))
    const wrapper = await mountLogin()
    await flushPromises()
    const notice = wrapper.find('[data-test="idle-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toBe('Session fermée après 45 minutes d’inactivité. Connectez-vous pour continuer.')
    expect(wrapper.text()).not.toContain('—')
  })

  it('default duration in the inactivity notice is 30 minutes', async () => {
    localStorage.setItem(LOCKED_KEY, JSON.stringify({ at: 1, reason: 'idle' }))
    const wrapper = await mountLogin()
    await flushPromises()
    expect(wrapper.find('[data-test="idle-notice"]').text()).toContain('après 30 minutes')
  })

  it('no inactivity notice without an idle lock (plain visit, explicit sign-out)', async () => {
    const wrapper = await mountLogin()
    await flushPromises()
    expect(wrapper.find('[data-test="idle-notice"]').exists()).toBe(false)
    localStorage.setItem(LOCKED_KEY, '1')
    const other = await mountLogin()
    await flushPromises()
    expect(other.find('[data-test="idle-notice"]').exists()).toBe(false)
  })

  async function passwordStepThenCode() {
    signInMock.mockRejectedValueOnce(Object.assign(new Error('mfa'), { code: 'auth/multi-factor-auth-required' }))
    const wrapper = await mountLogin()
    await wrapper.find('input#email').setValue('admin@yadony.com')
    await wrapper.find('input#password').setValue('pass123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    return wrapper
  }

  it('asks for the authenticator code when the account has a second factor', async () => {
    const wrapper = await passwordStepThenCode()
    const code = wrapper.find('input#totp-code')
    expect(code.exists()).toBe(true)
    expect(code.attributes('inputmode')).toBe('numeric')
    expect(code.attributes('autocomplete')).toBe('one-time-code')
    expect(wrapper.find('input#password').exists()).toBe(false)
  })

  it('completes the sign-in with the code and goes home', async () => {
    completeTotpMock.mockResolvedValueOnce({ mustChangePassword: false })
    const nav = vi.fn()
    vi.stubGlobal('navigateTo', nav)
    const wrapper = await passwordStepThenCode()
    await wrapper.find('input#totp-code').setValue('123456')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(completeTotpMock).toHaveBeenCalledWith('123456')
    expect(nav).toHaveBeenCalledWith('/')
  })

  it('shows a clear message for a wrong code', async () => {
    completeTotpMock.mockRejectedValueOnce(Object.assign(new Error('bad'), { code: 'auth/invalid-verification-code' }))
    const wrapper = await passwordStepThenCode()
    await wrapper.find('input#totp-code').setValue('000000')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Code incorrect')
  })

  it('goes back to the password step and drops the pending challenge', async () => {
    const wrapper = await passwordStepThenCode()
    await wrapper.find('[data-test="totp-back"]').trigger('click')
    expect(cancelTotpMock).toHaveBeenCalled()
    expect(wrapper.find('input#password').exists()).toBe(true)
  })

  it('confirms the enrollment after the forced sign-out', async () => {
    routeQuery = { mfa: 'enrolled' }
    const wrapper = await mountLogin()
    expect(wrapper.text()).toContain('Double authentification activée')
  })

  it('renders the login form with an email and password field', async () => {
    const wrapper = await mountLogin()
    const emailInput = wrapper.find('input#email')
    expect(emailInput.exists()).toBe(true)
    expect(emailInput.attributes('type')).toBe('email')
    expect(emailInput.attributes('autocomplete')).toBe('email')
    expect(wrapper.find('input#password').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Connexion')
  })

  it('does not render a demo login button', async () => {
    const wrapper = await mountLogin()
    expect(wrapper.find('[data-test="demo-login"]').exists()).toBe(false)
  })

  it('submit button disabled when fields empty', async () => {
    const wrapper = await mountLogin()
    const btn = wrapper.find('button[type="submit"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('submit button enabled when both fields filled', async () => {
    const wrapper = await mountLogin()
    await wrapper.find('input#email').setValue('admin@yadony.com')
    await wrapper.find('input#password').setValue('pass123')
    const btn = wrapper.find('button[type="submit"]')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('shows error message on invalid-credential', async () => {
    const err = Object.assign(new Error('bad creds'), { code: 'auth/invalid-credential' })
    signInMock.mockRejectedValueOnce(err)
    const wrapper = await mountLogin()
    await wrapper.find('input#email').setValue('admin@yadony.com')
    await wrapper.find('input#password').setValue('wrongpass')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Identifiants incorrects')
  })
})
