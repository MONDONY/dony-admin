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
})
