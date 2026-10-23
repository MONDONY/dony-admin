import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/components/layout/AppSidebar.vue', () => ({ default: { name: 'AppSidebar', template: '<nav />' } }))
vi.mock('@/components/layout/ShortcutsHelp.vue', () => ({ default: { name: 'ShortcutsHelp', template: '<div />' } }))
vi.mock('@/components/layout/AppTopbar.vue', () => ({
  default: {
    name: 'AppTopbar',
    props: ['title', 'subtitle', 'crumbs', 'backTo'],
    emits: ['back'],
    template: '<header><button data-test="back" @click="$emit(\'back\')" /><span data-test="back-to">{{ backTo }}</span></header>',
  },
}))

const pushMock = vi.fn()
const backMock = vi.fn()
let path = '/users/abc-123'
vi.stubGlobal('useRouter', () => ({ push: pushMock, back: backMock }))
vi.stubGlobal('useRoute', () => ({ path, meta: { pageTitle: 'Utilisateur' } }))
vi.stubGlobal('ClientOnly', { template: '<div><slot /></div>' })

async function mountLayout() {
  const Layout = (await import('@/layouts/default.vue')).default
  return mount(Layout, { global: { stubs: { ClientOnly: { template: '<div><slot /></div>' } } } })
}

describe('layout par défaut : bouton Retour', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    pushMock.mockReset(); backMock.mockReset()
    path = '/users/abc-123'
  })

  it('passe la liste parente à la barre du haut', async () => {
    const w = await mountLayout()
    expect(w.get('[data-test="back-to"]').text()).toBe('/users')
  })

  it('première visite (aucune page précédente) : va à la liste parente', async () => {
    window.history.replaceState(null, '')
    const w = await mountLayout()
    await w.get('[data-test="back"]').trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/users')
    expect(backMock).not.toHaveBeenCalled()
  })

  it('page précédente connue : revient en arrière (garde filtres et onglets)', async () => {
    window.history.replaceState({ back: '/users?query=awa' }, '')
    const w = await mountLayout()
    await w.get('[data-test="back"]').trigger('click')
    expect(backMock).toHaveBeenCalledTimes(1)
    expect(pushMock).not.toHaveBeenCalled()
  })
})
