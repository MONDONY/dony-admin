import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NavItem from '@/components/layout/NavItem.vue'

const NuxtLinkStub = {
  name: 'NuxtLink',
  template: '<a :href="to" :class="$attrs.class"><slot /></a>',
  props: ['to'],
}

describe('NavItem', () => {
  it('renders label and icon slot', () => {
    const wrapper = mount(NavItem, {
      props: { to: '/users', label: 'Utilisateurs' },
      slots: { icon: '<svg data-test="icon" />' },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(wrapper.text()).toContain('Utilisateurs')
    expect(wrapper.find('[data-test="icon"]').exists()).toBe(true)
  })

  it('shows badge when > 0', () => {
    const wrapper = mount(NavItem, {
      props: { to: '/alertes', label: 'Alertes', badge: 5 },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(wrapper.text()).toContain('5')
  })

  it('hides badge when 0', () => {
    const wrapper = mount(NavItem, {
      props: { to: '/alertes', label: 'Alertes', badge: 0 },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(wrapper.find('[data-test="badge"]').exists()).toBe(false)
  })
  it('« 99+ » au-delà de 99, chiffres tabulaires', () => {
    const wrapper = mount(NavItem, {
      props: { to: '/kyc', label: 'KYC', badge: 150 },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    const badge = wrapper.find('[data-test="badge"]')
    expect(badge.text()).toContain('99+')
    expect(badge.classes()).toContain('tabular-nums')
  })

  it('badge neutre par défaut, rouge en tonalité danger', () => {
    const neutral = mount(NavItem, {
      props: { to: '/kyc', label: 'KYC', badge: 2 },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    }).find('[data-test="badge"]')
    expect(neutral.attributes('data-tone')).toBe('neutral')
    expect(neutral.classes()).not.toContain('bg-danger')
    const danger = mount(NavItem, {
      props: { to: '/alertes', label: 'Alertes', badge: 2, badgeTone: 'danger' },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    }).find('[data-test="badge"]')
    expect(danger.attributes('data-tone')).toBe('danger')
    expect(danger.classes()).toContain('bg-danger')
  })

  it('libellé accessible du badge', () => {
    const wrapper = mount(NavItem, {
      props: { to: '/alertes', label: 'Alertes', badge: 3 },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(wrapper.find('[data-test="badge"] .sr-only').text()).toBe('à traiter')
  })
})
