import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useAuthStore, type AdminUser } from '@/stores/auth'

const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] }
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

/**
 * La spec principale n'affirme la disparition que de trois entrées. Les autres n'étaient
 * couvertes que par le test positif monté en ADMIN : supprimer leur `v-if` laissait la suite
 * verte tout en offrant à SUPPORT des entrées qui le renvoient toutes sur `/denied`.
 *
 * Chaque libellé ci-dessous correspond à une permission que `AdminRole.SUPPORT` n'accorde pas.
 */
const FORBIDDEN_TO_SUPPORT = [
  ['Codes promo', 'PROMO_MANAGE'],
  ['Audit', 'AUDIT_VIEW'],
  ['Exports', 'EXPORT_RUN'],
  ['Communications', 'NOTIFICATION_SEND'],
  ['Paramètres', 'CONFIG_MANAGE'],
  ['Demandes RGPD', 'USER_GDPR_DELETE'],
  ['Administrateurs', 'ADMIN_MANAGE'],
] as const

describe('AppSidebar — entrées interdites au rôle SUPPORT', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it.each(FORBIDDEN_TO_SUPPORT)('SUPPORT ne voit pas « %s » (%s)', (label) => {
    useAuthStore().setSession('token', makeAdmin('SUPPORT'))
    expect(mountSidebar().text()).not.toContain(label)
  })

  // Contre-épreuve : sans elle, les tests ci-dessus passeraient aussi si la barre latérale
  // ne rendait plus rien du tout.
  // SUPER_ADMIN et non ADMIN : `ADMIN_MANAGE` est la seule permission qu'ADMIN n'a pas
  // (EnumSet.complementOf côté back, ALL_PERMISSIONS.filter côté front).
  it.each(FORBIDDEN_TO_SUPPORT)('SUPER_ADMIN voit bien « %s »', (label) => {
    useAuthStore().setSession('token', makeAdmin('SUPER_ADMIN'))
    expect(mountSidebar().text()).toContain(label)
  })
})
