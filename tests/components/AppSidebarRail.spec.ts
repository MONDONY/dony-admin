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
const railBtn = (id: string) => wrapper!.find(`[data-test="nav-rail-${id}"]`)
const panel = (id: string) => wrapper!.find(`[data-test="nav-panel-${id}"]`)
const hrefs = () => wrapper!.findAll('nav a').map(a => a.attributes('href'))

describe('AppSidebar : rail d’icônes et panneaux', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    useAuthStore().setSession('t', makeAdmin('SUPER_ADMIN'))
    countersMock.mockReset()
    countersMock.mockResolvedValue({ counts: {}, unreadCount: 0 })
  })
  afterEach(() => { wrapper?.unmount(); wrapper = null; vi.useRealTimers() })

  it('le rail ne contient aucun titre h2 : les pages en ont besoin pour leurs propres panneaux (`aside h2`)', async () => {
    await mountSidebar()
    expect(wrapper!.find('aside h2').exists()).toBe(false)
  })

  it('un bouton par domaine, l’accueil en tête, toutes les pages dans les panneaux', async () => {
    await mountSidebar()
    expect(NAV_GROUPS.map(g => g.id)).toEqual(['accounts', 'money', 'activity', 'community', 'system'])
    for (const g of NAV_GROUPS) {
      expect(railBtn(g.id).exists()).toBe(true)
      expect(railBtn(g.id).text()).toContain(g.railLabel)
      expect(panel(g.id).find('[data-test="nav-panel-title"]').text()).toBe(g.label)
    }
    expect(hrefs()[0]).toBe(HOME_ENTRY.to)
    expect(hrefs()).toHaveLength(ALL_NAV_ENTRIES.length)
    expect(hrefs()).toEqual(expect.arrayContaining(ALL_NAV_ENTRIES.map(e => e.to)))
  })

  it('le panneau s’ouvre au survol ou au focus (classes de survol) et reste fermé sinon', async () => {
    await mountSidebar()
    const cls = panel('money').classes()
    expect(cls).toContain('hidden')
    expect(cls).toContain('group-hover/dm:flex')
    expect(cls).toContain('group-focus-within/dm:flex')
    expect(cls).not.toContain('!hidden')
  })

  it('le domaine de la page affichée est allumé dans le rail, pas les autres', async () => {
    await mountSidebar('/transactions/anything')
    expect(railBtn('money').attributes('aria-current')).toBe('true')
    expect(railBtn('money').classes()).toContain('text-primary')
    expect(railBtn('accounts').attributes('aria-current')).toBeUndefined()
    expect(railBtn('system').classes()).not.toContain('text-primary')
  })

  it('dans le panneau, seule la page affichée est courante (/users/rgpd n’allume pas Utilisateurs)', async () => {
    await mountSidebar('/users/rgpd')
    expect(wrapper!.find('nav a[href="/users/rgpd"]').attributes('aria-current')).toBe('page')
    expect(wrapper!.find('nav a[href="/users"]').attributes('aria-current')).toBeUndefined()
    expect(railBtn('accounts').attributes('aria-current')).toBe('true')
  })

  it('une fiche /users/abc garde Utilisateurs courant', async () => {
    await mountSidebar('/users/abc-123')
    expect(wrapper!.find('nav a[href="/users"]').attributes('aria-current')).toBe('page')
  })

  it('l’accueil n’est allumé que sur « / » ; aucun domaine allumé', async () => {
    await mountSidebar('/')
    const home = wrapper!.find('[data-test="nav-rail-home"]')
    expect(home.attributes('aria-current')).toBe('page')
    expect(home.classes()).toContain('text-primary')
    for (const g of NAV_GROUPS) expect(railBtn(g.id).attributes('aria-current')).toBeUndefined()
  })

  it('une page hors menu n’allume rien', async () => {
    await mountSidebar('/change-password')
    expect(wrapper!.find('[data-test="nav-rail-home"]').attributes('aria-current')).toBeUndefined()
    for (const g of NAV_GROUPS) expect(railBtn(g.id).attributes('aria-current')).toBeUndefined()
  })

  it('un clic sur une page referme le panneau jusqu’à ce que la souris quitte le rail', async () => {
    await mountSidebar()
    const aside = wrapper!.find('aside')
    expect(aside.attributes('data-shut')).toBe('false')
    await wrapper!.find('nav a[href="/colis"]').trigger('click')
    expect(aside.attributes('data-shut')).toBe('true')
    expect(panel('activity').classes()).toContain('!hidden')
    await aside.trigger('mouseleave')
    expect(aside.attributes('data-shut')).toBe('false')
    expect(panel('activity').classes()).not.toContain('!hidden')
  })

  it('le focus clavier dans le rail rouvre un panneau refermé par un clic', async () => {
    await mountSidebar()
    const aside = wrapper!.find('aside')
    await wrapper!.find('nav a[href="/colis"]').trigger('click')
    expect(aside.attributes('data-shut')).toBe('true')
    await aside.trigger('focusin')
    expect(aside.attributes('data-shut')).toBe('false')
  })

  it('le point du rail porte le total du domaine (rouge si l’une des pastilles est urgente)', async () => {
    countersMock.mockResolvedValue({ counts: { kyc: 3, gdpr: 4, alerts: 2, reports: 1 }, unreadCount: 0 })
    await mountSidebar()
    const accounts = railBtn('accounts').find('[data-test="nav-rail-badge"]')
    expect(accounts.text()).toContain('7')
    expect(accounts.attributes('data-tone')).toBe('neutral')
    const activity = railBtn('activity').find('[data-test="nav-rail-badge"]')
    expect(activity.text()).toContain('3')
    expect(activity.attributes('data-tone')).toBe('danger')
    expect(railBtn('system').find('[data-test="nav-rail-badge"]').exists()).toBe(false)
  })

  it('les pastilles des pages restent dans le panneau', async () => {
    countersMock.mockResolvedValue({ counts: { kyc: 3 }, unreadCount: 0 })
    await mountSidebar()
    expect(panel('accounts').find('a[href="/kyc"] [data-test="badge"]').exists()).toBe(true)
  })

  it('un domaine sans aucune page autorisée disparaît du rail', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPPORT'))
    await mountSidebar()
    expect(railBtn('money').exists()).toBe(true) // Transactions reste visible
    expect(railBtn('system').exists()).toBe(false)
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

  it('le menu du profil rappelle l’e-mail et le rôle', async () => {
    await mountSidebar()
    await wrapper!.find('[data-test="profile-menu-trigger"]').trigger('click')
    const menu = wrapper!.find('[data-test="profile-menu"]')
    expect(menu.text()).toContain(useAuthStore().user!.email)
    expect(menu.text()).toContain('SUPER_ADMIN')
  })
})
