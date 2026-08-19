import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useAuthStore, type AdminUser } from '@/stores/auth'

const NuxtLinkStub = {
  name: 'NuxtLink',
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}
const ClientOnlyStub = { name: 'ClientOnly', template: '<div><slot /></div>' }

const makeAdmin = (role: AdminUser['role']): AdminUser => ({
  id: 'u', email: 'admin@yadony.com', role, status: 'ACTIVE',
  mustChangePassword: false, permissionOverrides: {},
})

function mountSidebar() {
  return mount(AppSidebar, {
    global: { stubs: { NuxtLink: NuxtLinkStub, ClientOnly: ClientOnlyStub } },
  })
}

describe('AppSidebar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders all 11 module links', () => {
    useAuthStore().setSession('token', makeAdmin('ADMIN'))
    const wrapper = mountSidebar()
    const labels = [
      'Vue d’ensemble', 'Utilisateurs', 'Transactions', 'Colis',
      'Incidents', 'Alertes', 'Modération', 'Codes promo',
      'Audit', 'Exports', 'Signalements',
    ]
    for (const label of labels) {
      expect(wrapper.text()).toContain(label)
    }
  })

  it('shows Administrateurs only to SUPER_ADMIN', () => {
    useAuthStore().setSession('token', makeAdmin('SUPER_ADMIN'))
    expect(mountSidebar().text()).toContain('Administrateurs')
  })

  it('hides Administrateurs from ADMIN', () => {
    useAuthStore().setSession('token', makeAdmin('ADMIN'))
    expect(mountSidebar().text()).not.toContain('Administrateurs')
  })

  it('hides Administrateurs from SUPPORT', () => {
    useAuthStore().setSession('token', makeAdmin('SUPPORT'))
    expect(mountSidebar().text()).not.toContain('Administrateurs')
  })

  it('hides Administrateurs when unauthenticated', () => {
    expect(mountSidebar().text()).not.toContain('Administrateurs')
  })

  it('montre « Demandes RGPD » à un ADMIN (USER_GDPR_DELETE)', () => {
    useAuthStore().setSession('token', makeAdmin('ADMIN'))
    expect(mountSidebar().text()).toContain('Demandes RGPD')
  })

  it('cache « Demandes RGPD » à SUPPORT (pas de USER_GDPR_DELETE)', () => {
    useAuthStore().setSession('token', makeAdmin('SUPPORT'))
    expect(mountSidebar().text()).not.toContain('Demandes RGPD')
  })

  it('montre « Paramètres » à un ADMIN (CONFIG_MANAGE)', () => {
    useAuthStore().setSession('token', makeAdmin('ADMIN'))
    expect(mountSidebar().text()).toContain('Paramètres')
  })

  it('cache « Paramètres » à SUPPORT (pas de CONFIG_MANAGE)', () => {
    useAuthStore().setSession('token', makeAdmin('SUPPORT'))
    expect(mountSidebar().text()).not.toContain('Paramètres')
  })

  it('profile menu is closed by default', () => {
    useAuthStore().setSession('token', makeAdmin('ADMIN'))
    const wrapper = mountSidebar()
    expect(wrapper.find('[data-test="profile-change-password"]').exists()).toBe(false)
  })

  it('opens the profile menu on click and shows "Changer mon mot de passe"', async () => {
    useAuthStore().setSession('token', makeAdmin('ADMIN'))
    const wrapper = mountSidebar()
    await wrapper.find('[data-test="profile-menu-trigger"]').trigger('click')
    const link = wrapper.find('[data-test="profile-change-password"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/change-password')
  })

  it('closes the profile menu after clicking the change-password link', async () => {
    useAuthStore().setSession('token', makeAdmin('ADMIN'))
    const wrapper = mountSidebar()
    await wrapper.find('[data-test="profile-menu-trigger"]').trigger('click')
    await wrapper.find('[data-test="profile-change-password"]').trigger('click')
    expect(wrapper.find('[data-test="profile-change-password"]').exists()).toBe(false)
  })
})
