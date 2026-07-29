import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginLeftPanel from '@/features/auth/components/LoginLeftPanel.vue'

describe('LoginLeftPanel', () => {
  it('renders the Yadony ADMIN logo', () => {
    const wrapper = mount(LoginLeftPanel)
    expect(wrapper.find('img[alt="Yadony"]').attributes('src')).toBe('/logos/logo-yadony.png')
    expect(wrapper.text()).toContain('ADMIN')
  })

  it('renders the ADMIN badge', () => {
    const wrapper = mount(LoginLeftPanel)
    expect(wrapper.text()).toContain('ADMIN')
  })

  it('renders the securise mascot image', () => {
    const wrapper = mount(LoginLeftPanel)
    const img = wrapper.find('img[src="/mascots/securise.png"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/mascots/securise.png')
    expect(img.attributes('alt')).toBe('Mascotte Yadony avec bouclier de sécurité vérifié')
  })

  it('ships the full-size security mascot asset', () => {
    const mascot = readFileSync('public/mascots/securise.png')
    expect(mascot.readUInt32BE(16)).toBe(768)
    expect(mascot.readUInt32BE(20)).toBe(768)
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
