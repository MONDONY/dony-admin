import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

const countersMock = vi.fn()
vi.mock('@/features/notifications/services/notificationsService', () => ({
  notificationsService: {
    counters: (...a: unknown[]) => countersMock(...a),
    feed: vi.fn(),
    markSeen: vi.fn(),
  },
}))

import AppSidebar from '@/components/layout/AppSidebar.vue'
import { NAV_GROUPS, HOME_ENTRY, ALL_NAV_ENTRIES } from '@/components/layout/navConfig'
import { useShortcutsHelp } from '@/composables/useShortcuts'
import { useAuthStore } from '@/stores/auth'
import { makeAdmin } from '../helpers/auth'

const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] }
const ClientOnlyStub = { name: 'ClientOnly', template: '<div><slot /></div>' }

let wrapper: VueWrapper | null = null
async function mountSidebar(path?: string) {
  const plugins = []
  if (path) {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
    await router.push(path)
    plugins.push(router)
  }
  wrapper = mount(AppSidebar, { global: { plugins, stubs: { NuxtLink: NuxtLinkStub, ClientOnly: ClientOnlyStub } } })
  await flushPromises()
  return wrapper
}
const toggle = (id: string) => wrapper!.find(`[data-test="nav-group-toggle-${id}"]`)
const hrefs = () => wrapper!.findAll('nav a').map(a => a.attributes('href'))

describe('AppSidebar : groupes repliables', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    setActivePinia(createPinia())
    useAuthStore().setSession('t', makeAdmin('SUPER_ADMIN'))
    countersMock.mockReset()
    countersMock.mockResolvedValue({ counts: {}, unreadCount: 0 })
  })
  afterEach(() => { wrapper?.unmount(); wrapper = null; vi.useRealTimers() })

  it('range toutes les pages dans cinq groupes, accueil en tête hors groupe', async () => {
    await mountSidebar()
    expect(NAV_GROUPS.map(g => g.id)).toEqual(['accounts', 'money', 'activity', 'community', 'system'])
    expect(hrefs()[0]).toBe(HOME_ENTRY.to)
    expect(hrefs()).toEqual(expect.arrayContaining(ALL_NAV_ENTRIES.map(e => e.to)))
    expect(hrefs()).toHaveLength(ALL_NAV_ENTRIES.length)
  })

  it('tout est ouvert par défaut', async () => {
    await mountSidebar()
    for (const g of NAV_GROUPS) expect(toggle(g.id).attributes('aria-expanded')).toBe('true')
  })

  it('un clic replie le groupe, un second le rouvre, et le choix est mémorisé', async () => {
    await mountSidebar()
    await toggle('money').trigger('click')
    expect(toggle('money').attributes('aria-expanded')).toBe('false')
    expect(wrapper!.find('#nav-group-money').attributes('style')).toContain('display: none')
    expect(JSON.parse(localStorage.getItem('yadony.admin.nav.collapsed')!)).toEqual(['money'])

    wrapper!.unmount()
    await mountSidebar()
    expect(toggle('money').attributes('aria-expanded')).toBe('false')

    await toggle('money').trigger('click')
    expect(toggle('money').attributes('aria-expanded')).toBe('true')
    expect(JSON.parse(localStorage.getItem('yadony.admin.nav.collapsed')!)).toEqual([])
  })

  it('un stockage illisible ou bloqué ne casse pas le menu', async () => {
    localStorage.setItem('yadony.admin.nav.collapsed', '{pas du json')
    await mountSidebar()
    expect(toggle('money').attributes('aria-expanded')).toBe('true')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await toggle('money').trigger('click')
    expect(toggle('money').attributes('aria-expanded')).toBe('false')
    spy.mockRestore()
  })

  it('ignore un contenu mémorisé qui n’est pas une liste de chaînes', async () => {
    localStorage.setItem('yadony.admin.nav.collapsed', '{"a":1}')
    await mountSidebar()
    expect(toggle('money').attributes('aria-expanded')).toBe('true')
    wrapper!.unmount()
    localStorage.setItem('yadony.admin.nav.collapsed', '["money", 3]')
    await mountSidebar()
    expect(toggle('money').attributes('aria-expanded')).toBe('false')
  })

  it('le groupe de la page affichée reste ouvert même si on l’a replié, et son en-tête le signale une fois replié', async () => {
    localStorage.setItem('yadony.admin.nav.collapsed', JSON.stringify(['money', 'system']))
    await mountSidebar('/transactions/anything')
    expect(toggle('money').attributes('aria-expanded')).toBe('true')
    expect(toggle('system').attributes('aria-expanded')).toBe('false')
    expect(wrapper!.find('[data-test="nav-group-system"] [data-test="nav-group-active"]').exists()).toBe(false)
  })

  it('l’accueil n’active que « / » exactement', async () => {
    localStorage.setItem('yadony.admin.nav.collapsed', JSON.stringify(['accounts']))
    await mountSidebar('/')
    expect(toggle('accounts').attributes('aria-expanded')).toBe('false')
  })

  it('replié, un groupe porte le total de ses pastilles (rouge si l’une est urgente)', async () => {
    countersMock.mockResolvedValue({ counts: { kyc: 3, gdpr: 4, alerts: 2, reports: 1 }, unreadCount: 0 })
    localStorage.setItem('yadony.admin.nav.collapsed', JSON.stringify(['accounts', 'activity']))
    await mountSidebar()
    const accounts = wrapper!.find('[data-test="nav-group-accounts"] [data-test="nav-group-badge"]')
    expect(accounts.text()).toContain('7')
    expect(accounts.attributes('data-tone')).toBe('neutral')
    const activity = wrapper!.find('[data-test="nav-group-activity"] [data-test="nav-group-badge"]')
    expect(activity.text()).toContain('3')
    expect(activity.attributes('data-tone')).toBe('danger')
  })

  it('ouvert, le groupe ne double pas les pastilles de ses entrées', async () => {
    countersMock.mockResolvedValue({ counts: { kyc: 3 }, unreadCount: 0 })
    await mountSidebar()
    expect(wrapper!.find('[data-test="nav-group-accounts"] [data-test="nav-group-badge"]').exists()).toBe(false)
    expect(wrapper!.find('nav a[href="/kyc"] [data-test="badge"]').exists()).toBe(true)
  })

  it('un groupe sans aucune page autorisée disparaît', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPPORT'))
    await mountSidebar()
    expect(wrapper!.find('[data-test="nav-group-money"]').exists()).toBe(true) // Transactions reste visible
    expect(wrapper!.find('[data-test="nav-group-system"]').exists()).toBe(false)
  })

  it('« Raccourcis clavier » dans le menu du profil ouvre l’aide', async () => {
    await mountSidebar()
    useShortcutsHelp().hide()
    await wrapper!.find('[data-test="profile-menu-trigger"]').trigger('click')
    await wrapper!.find('[data-test="profile-shortcuts"]').trigger('click')
    expect(useShortcutsHelp().open.value).toBe(true)
    expect(wrapper!.find('[data-test="profile-menu"]').exists()).toBe(false)
    useShortcutsHelp().hide()
  })
})
