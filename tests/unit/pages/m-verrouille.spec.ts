import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.stubGlobal('definePageMeta', vi.fn())
const navigateMock = vi.fn()
vi.stubGlobal('navigateTo', navigateMock)
vi.stubGlobal('useRoute', () => ({ path: '/m/verrouille', query: {} }))
// Le middleware est importé statiquement (import remonté) : le stub doit le précéder.
vi.hoisted(() => { vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn) })

const signInMock = vi.fn()
const completeTotpMock = vi.fn()
const cancelTotpMock = vi.fn()
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ signIn: signInMock, completeTotpSignIn: completeTotpMock, cancelTotpSignIn: cancelTotpMock }),
}))

import { defineComponent, h, type Component } from 'vue'
import Page from '@/pages/m/verrouille.vue'
import { LOCK_CONTEXT_KEY } from '@/features/mobile/composables/useIdleLock'
import { LOCKED_KEY, clearLockContext } from '@/features/mobile/lib/lockState'
import authMiddleware from '@/middleware/auth.global'

const mfaError = () => Object.assign(new Error('mfa'), { code: 'auth/multi-factor-auth-required' })

function remember(path: string | null, email: string | null = null) {
  sessionStorage.setItem(LOCK_CONTEXT_KEY, JSON.stringify({ path, email }))
}

async function fillPassword(w: ReturnType<typeof mount>, email = 'admin@yadony.com') {
  if (email) await w.find('input#email').setValue(email)
  await w.find('input#password').setValue('pass123')
  await w.find('form').trigger('submit')
  await flushPromises()
}

describe('m/verrouille page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    signInMock.mockReset(); completeTotpMock.mockReset(); cancelTotpMock.mockReset(); navigateMock.mockReset()
    sessionStorage.clear()
    localStorage.clear()
    clearLockContext()
  })

  it('locked for inactivity: shows the lock message and the one-line button', async () => {
    localStorage.setItem(LOCKED_KEY, JSON.stringify({ at: 1, reason: 'idle' }))
    const w = mount(Page)
    await flushPromises()
    expect(w.text()).toContain('Session verrouillée')
    expect(w.text()).toContain('Votre session a été fermée après 30 minutes d’inactivité.')
    expect(w.find('button[type="submit"]').text()).toBe('Se reconnecter')
    expect(w.text()).not.toContain('—')
  })

  it('first launch or session ended (no idle lock): asks to sign in, without the inactivity sentence', async () => {
    const w = mount(Page)
    await flushPromises()
    expect(w.text()).toContain('Connectez-vous pour continuer.')
    expect(w.text()).not.toContain('30 minutes')
    expect(w.text()).not.toContain('Session verrouillée')
    expect(w.find('button[type="submit"]').text()).toBe('Se connecter')
  })

  it('speaks with vouvoiement on every step', async () => {
    signInMock.mockRejectedValueOnce(mfaError())
    completeTotpMock.mockRejectedValueOnce(Object.assign(new Error('bad'), { code: 'auth/invalid-verification-code' }))
    const w = mount(Page)
    await fillPassword(w)
    expect(w.text()).toContain('Saisissez le code à 6 chiffres affiché par votre appli d’authentification.')
    await w.find('input#totp-code').setValue('000000')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Code incorrect. Vérifiez l’heure de votre téléphone et réessayez.')
    expect(w.text()).not.toMatch(/\b(ton|ta|tes|toi|Saisis|Réessaie|Reconnecte-toi)\b/)
  })

  it('prefills the remembered email', async () => {
    remember('/m/alertes', 'admin@yadony.com')
    const w = mount(Page)
    await flushPromises()
    expect((w.find('input#email').element as HTMLInputElement).value).toBe('admin@yadony.com')
  })

  it('returns to the /m page the middleware remembered (unauthenticated deep link)', async () => {
    await (authMiddleware as unknown as (_to: { path: string, fullPath: string }) => unknown)({ path: '/m/alertes/abc', fullPath: '/m/alertes/abc' })
    expect(navigateMock).toHaveBeenCalledWith('/m/verrouille')
    navigateMock.mockReset()
    signInMock.mockResolvedValueOnce({ mustChangePassword: false })
    const w = mount(Page)
    await fillPassword(w)
    expect(navigateMock).toHaveBeenCalledWith('/m/alertes/abc')
  })

  it('password step then TOTP step, then returns to the remembered page', async () => {
    remember('/m/alertes?item=A:B')
    signInMock.mockRejectedValueOnce(mfaError())
    completeTotpMock.mockResolvedValueOnce({ mustChangePassword: false })
    const w = mount(Page)
    await fillPassword(w)
    expect(w.find('input#totp-code').exists()).toBe(true)
    expect(w.find('input#password').exists()).toBe(false)
    expect(w.find('button[type="submit"]').text()).toBe('Valider le code')
    await w.find('input#totp-code').setValue('123 456')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(completeTotpMock).toHaveBeenCalledWith('123 456')
    expect(navigateMock).toHaveBeenCalledWith('/m/alertes?item=A:B')
    expect(sessionStorage.getItem(LOCK_CONTEXT_KEY)).toBeNull()
  })

  it('goes straight back when no second factor is needed', async () => {
    remember('/m/support')
    signInMock.mockResolvedValueOnce({ mustChangePassword: false })
    const w = mount(Page)
    await fillPassword(w)
    expect(signInMock).toHaveBeenCalledWith('admin@yadony.com', 'pass123')
    expect(navigateMock).toHaveBeenCalledWith('/m/support')
  })

  it('wrong password shows an error and stays on the page', async () => {
    signInMock.mockRejectedValueOnce(Object.assign(new Error('bad'), { code: 'auth/invalid-credential' }))
    const w = mount(Page)
    await fillPassword(w)
    expect(w.text()).toContain('Identifiants incorrects')
    expect(navigateMock).not.toHaveBeenCalled()
    expect(w.find('input#password').exists()).toBe(true)
  })

  it.each([
    ['auth/too-many-requests', 'Trop de tentatives. Réessayez dans quelques minutes.'],
    ['auth/other', 'Erreur de connexion. Réessayez.'],
  ])('maps %s to a French message', async (code, text) => {
    signInMock.mockRejectedValueOnce(Object.assign(new Error('x'), { code }))
    const w = mount(Page)
    await fillPassword(w)
    expect(w.text()).toContain(text)
  })

  it('wrong TOTP code shows an error and stays on the code step', async () => {
    signInMock.mockRejectedValueOnce(mfaError())
    completeTotpMock.mockRejectedValueOnce(Object.assign(new Error('bad'), { code: 'auth/invalid-verification-code' }))
    const w = mount(Page)
    await fillPassword(w)
    await w.find('input#totp-code').setValue('000000')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Code incorrect')
    expect(w.find('input#totp-code').exists()).toBe(true)
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('too many TOTP attempts and expired challenge are handled', async () => {
    signInMock.mockRejectedValueOnce(mfaError())
    completeTotpMock
      .mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/too-many-requests' }))
      .mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/code-expired' }))
    const w = mount(Page)
    await fillPassword(w)
    await w.find('input#totp-code').setValue('000000')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Trop de tentatives')
    await w.find('input#totp-code').setValue('111111')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Le code a expiré. Reconnectez-vous.')
    expect(cancelTotpMock).toHaveBeenCalled()
    expect(w.find('input#password').exists()).toBe(true)
  })

  it('back button returns to the password step', async () => {
    signInMock.mockRejectedValueOnce(mfaError())
    const w = mount(Page)
    await fillPassword(w)
    await w.find('[data-test="totp-back"]').trigger('click')
    expect(cancelTotpMock).toHaveBeenCalled()
    expect(w.find('input#password').exists()).toBe(true)
  })

  it('ignores a submit with empty fields or an incomplete code', async () => {
    const w = mount(Page)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(signInMock).not.toHaveBeenCalled()
    signInMock.mockRejectedValueOnce(mfaError())
    await fillPassword(w)
    await w.find('input#totp-code').setValue('12')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(completeTotpMock).not.toHaveBeenCalled()
  })

  it.each([
    ['//evil.test'], ['https://evil.test'], ['/login'], ['javascript:alert(1)'], [null],
  ])('rejected return path %s falls back to /m', async (bad) => {
    remember(bad)
    signInMock.mockResolvedValueOnce({ mustChangePassword: false })
    const w = mount(Page)
    await fillPassword(w)
    expect(navigateMock).toHaveBeenCalledWith('/m')
  })

  it('follows the change-password redirect like login', async () => {
    remember('/m/alertes')
    signInMock.mockResolvedValueOnce({ mustChangePassword: true })
    const w = mount(Page)
    await fillPassword(w)
    expect(navigateMock).toHaveBeenCalledWith('/change-password')
  })

  it('is rendered in the real "auth" layout, which has no tab bar', async () => {
    mount(Page)
    const meta = vi.mocked(definePageMeta as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as { layout?: string }
    expect(meta.layout).toBe('auth')
    // Même résolution que Nuxt : `layout: 'auth'` -> app/layouts/auth.vue.
    const loaders = import.meta.glob('../../../app/layouts/*.vue')
    const load = loaders[`../../../app/layouts/${meta.layout}.vue`]
    expect(load).toBeDefined()
    const Layout = ((await load!()) as { default: Component }).default
    const w = mount(defineComponent({ render: () => h(Layout, null, { default: () => h(Page) }) }))
    await flushPromises()
    expect(w.find('input#password').exists()).toBe(true)
    // Ni la barre d'onglets du layout mobile, ni aucune navigation.
    expect(w.find('[data-test="mobile-tab"]').exists()).toBe(false)
    expect(w.find('nav[aria-label="Navigation principale"]').exists()).toBe(false)
    expect(w.find('nav').exists()).toBe(false)
  })
})
