import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: null }))

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
const signOutMock = vi.fn()
const refreshProfileMock = vi.fn()
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ signOut: signOutMock, refreshProfile: refreshProfileMock }),
}))
vi.mock('@/components/ui/ThemeToggle.vue', () => ({
  default: { name: 'ThemeToggle', template: '<div />' },
}))

async function mountForcedChange() {
  const store = useAuthStore()
  store.user = { mustChangePassword: true } as typeof store.user
  const mod = await import('@/pages/change-password.vue')
  return mount(mod.default)
}

async function submit(wrapper: Awaited<ReturnType<typeof mountForcedChange>>) {
  await wrapper.find('input#new-password').setValue('NouveauMotDePasse!1')
  await wrapper.find('input#confirm-password').setValue('NouveauMotDePasse!1')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('change-password page — reconnexion exigée par le back', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiMock.mockReset()
    signOutMock.mockReset()
  })

  it('ADMIN_RECENT_LOGIN_REQUIRED : explique et propose de se reconnecter', async () => {
    apiMock.mockRejectedValueOnce(Object.assign(new Error('403'), {
      data: { code: 'ADMIN_RECENT_LOGIN_REQUIRED' },
    }))
    const wrapper = await mountForcedChange()
    await submit(wrapper)

    expect(wrapper.text()).toContain('Reconnecte-toi')
    const relogin = wrapper.find('[data-test="relogin"]')
    expect(relogin.exists()).toBe(true)
    await relogin.trigger('click')
    expect(signOutMock).toHaveBeenCalled()
  })

  it('autre erreur : message générique, pas de bouton de reconnexion', async () => {
    apiMock.mockRejectedValueOnce(Object.assign(new Error('500'), { data: { code: 'FIREBASE_UPDATE_FAILED' } }))
    const wrapper = await mountForcedChange()
    await submit(wrapper)

    expect(wrapper.text()).toContain('Réessaie')
    expect(wrapper.find('[data-test="relogin"]').exists()).toBe(false)
  })
})
