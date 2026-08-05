import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({ public: { firebaseApiKey: 'key' } }))
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('import.meta', { dev: false })

const signInMock = vi.fn()
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ signIn: signInMock }),
}))
vi.mock('@/components/ui/ThemeToggle.vue', () => ({
  default: { name: 'ThemeToggle', template: '<div />' },
}))

async function mountLogin() {
  const mod = await import('@/pages/login.vue')
  return mount(mod.default)
}

describe('login page (email+password)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    signInMock.mockReset()
    vi.mocked(vi.stubGlobal('navigateTo', vi.fn()))
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
