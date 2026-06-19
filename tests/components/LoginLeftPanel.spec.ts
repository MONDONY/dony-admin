import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginLeftPanel from '@/features/auth/components/LoginLeftPanel.vue'

describe('LoginLeftPanel', () => {
  it('renders the dony logo text', () => {
    const wrapper = mount(LoginLeftPanel)
    expect(wrapper.text()).toContain('dony')
  })

  it('renders the ADMIN badge', () => {
    const wrapper = mount(LoginLeftPanel)
    expect(wrapper.text()).toContain('ADMIN')
  })

  it('renders the securise mascot image', () => {
    const wrapper = mount(LoginLeftPanel)
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/mascots/securise.png')
  })

  it('renders 3 security reassurance items', () => {
    const wrapper = mount(LoginLeftPanel)
    const items = wrapper.findAll('[data-test="security-item"]')
    expect(items).toHaveLength(3)
  })

  it('mentions Stripe in the first security item', () => {
    const wrapper = mount(LoginLeftPanel)
    const items = wrapper.findAll('[data-test="security-item"]')
    expect(items[0].text()).toContain('Stripe')
  })

  it('mentions KYC in the second security item', () => {
    const wrapper = mount(LoginLeftPanel)
    const items = wrapper.findAll('[data-test="security-item"]')
    expect(items[1].text()).toContain('KYC')
  })

  it('mentions SMS in the third security item', () => {
    const wrapper = mount(LoginLeftPanel)
    const items = wrapper.findAll('[data-test="security-item"]')
    expect(items[2].text()).toContain('SMS')
  })
})
