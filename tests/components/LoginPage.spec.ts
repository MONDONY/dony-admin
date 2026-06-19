import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

vi.stubGlobal('definePageMeta', vi.fn())
const navigateMock = vi.fn()
vi.stubGlobal('navigateTo', navigateMock)

vi.mock('@/features/auth/components/PhoneNumberForm.vue', () => ({
  default: { name: 'PhoneNumberForm', template: '<div class="phone-form" />', emits: ['sent'] },
}))
vi.mock('@/features/auth/components/OtpForm.vue', () => ({
  default: { name: 'OtpForm', template: '<div class="otp-form" />', props: ['phone'], emits: ['resend'] },
}))
vi.mock('@/components/ui/ThemeToggle.vue', () => ({
  default: { name: 'ThemeToggle', template: '<div />' },
}))

describe('login page', () => {
  beforeEach(() => navigateMock.mockClear())

  it('starts at phone step showing PhoneNumberForm', async () => {
    const mod = await import('@/pages/login.vue')
    const wrapper = mount(mod.default)
    expect(wrapper.find('.phone-form').exists()).toBe(true)
    expect(wrapper.find('.otp-form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Connexion')
  })

  it('transitions to otp step when @sent is emitted', async () => {
    const mod = await import('@/pages/login.vue')
    const wrapper = mount(mod.default)

    await wrapper.findComponent({ name: 'PhoneNumberForm' }).vm.$emit('sent', '+33600000000')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.otp-form').exists()).toBe(true)
    expect(wrapper.find('.phone-form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Code de vérification')
  })

  it('back button calls navigateTo("/") when at phone step', async () => {
    const mod = await import('@/pages/login.vue')
    const wrapper = mount(mod.default)
    await wrapper.find('button').trigger('click')
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('back button returns to phone step when at otp step', async () => {
    const mod = await import('@/pages/login.vue')
    const wrapper = mount(mod.default)

    // Go to OTP step
    await wrapper.findComponent({ name: 'PhoneNumberForm' }).vm.$emit('sent', '+33600000000')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.otp-form').exists()).toBe(true)

    // Click back
    await wrapper.find('button').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.phone-form').exists()).toBe(true)
  })

  it('@resend on OtpForm resets to phone step', async () => {
    const mod = await import('@/pages/login.vue')
    const wrapper = mount(mod.default)

    await wrapper.findComponent({ name: 'PhoneNumberForm' }).vm.$emit('sent', '+33600000000')
    await wrapper.vm.$nextTick()

    await wrapper.findComponent({ name: 'OtpForm' }).vm.$emit('resend')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.phone-form').exists()).toBe(true)
  })
})
