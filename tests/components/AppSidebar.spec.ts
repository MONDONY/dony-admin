import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const NuxtLinkStub = {
  name: 'NuxtLink',
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}
const ClientOnlyStub = { name: 'ClientOnly', template: '<div><slot /></div>' }

describe('AppSidebar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders all 11 module links', () => {
    const wrapper = mount(AppSidebar, {
      global: { stubs: { NuxtLink: NuxtLinkStub, ClientOnly: ClientOnlyStub } },
    })
    const labels = [
      'Vue d’ensemble', 'Utilisateurs', 'Transactions', 'Colis',
      'Incidents', 'Alertes', 'Modération', 'Codes promo',
      'Audit', 'Exports', 'Signalements',
    ]
    for (const label of labels) {
      expect(wrapper.text()).toContain(label)
    }
  })
})
