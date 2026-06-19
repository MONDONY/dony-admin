import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PhoneNumberForm from '@/features/auth/components/PhoneNumberForm.vue'

const sendOtpMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ sendOtp: sendOtpMock }),
}))

describe('PhoneNumberForm', () => {
  beforeEach(() => { sendOtpMock.mockClear() })

  it('renders country selector button with default FR', () => {
    const wrapper = mount(PhoneNumberForm)
    expect(wrapper.text()).toContain('+33')
    expect(wrapper.text()).toContain('🇫🇷')
  })

  it('renders 4 quick country chips', () => {
    const wrapper = mount(PhoneNumberForm)
    const chips = wrapper.findAll('[data-test="country-chip"]')
    expect(chips).toHaveLength(4)
  })

  it('clicking SN chip switches dial code to +221', async () => {
    const wrapper = mount(PhoneNumberForm)
    const chips = wrapper.findAll('[data-test="country-chip"]')
    await chips[1].trigger('click') // Sénégal
    await wrapper.find('input[type="tel"]').setValue('771234567')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(sendOtpMock).toHaveBeenCalledWith('+221771234567', 'recaptcha-container')
  })

  it('shows error when local number is empty on submit', async () => {
    const wrapper = mount(PhoneNumberForm)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Numéro invalide')
    expect(sendOtpMock).not.toHaveBeenCalled()
  })

  it('shows error when local number has fewer than 7 digits', async () => {
    const wrapper = mount(PhoneNumberForm)
    await wrapper.find('input[type="tel"]').setValue('123')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Numéro invalide')
  })

  it('calls sendOtp with concatenated dial+local and emits sent', async () => {
    const wrapper = mount(PhoneNumberForm)
    await wrapper.find('input[type="tel"]').setValue('612345678')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(sendOtpMock).toHaveBeenCalledWith('+33612345678', 'recaptcha-container')
    expect(wrapper.emitted('sent')).toBeTruthy()
    expect(wrapper.emitted('sent')![0]).toEqual(['+33612345678'])
  })

  it('calls sendOtp with SN dial code when SN chip selected', async () => {
    const wrapper = mount(PhoneNumberForm)
    const chips = wrapper.findAll('[data-test="country-chip"]')
    await chips[1].trigger('click') // Sénégal +221
    await wrapper.find('input[type="tel"]').setValue('771234567')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(sendOtpMock).toHaveBeenCalledWith('+221771234567', 'recaptcha-container')
  })

  it('shows network error message when sendOtp rejects', async () => {
    sendOtpMock.mockRejectedValueOnce(new Error('auth/too-many-requests'))
    const wrapper = mount(PhoneNumberForm)
    await wrapper.find('input[type="tel"]').setValue('612345678')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('auth/too-many-requests')
  })

  it('active chip has text-primary class', async () => {
    const wrapper = mount(PhoneNumberForm)
    const chips = wrapper.findAll('[data-test="country-chip"]')
    // FR est actif par défaut
    expect(chips[0].classes()).toContain('text-primary')
    // Après clic sur SN, SN doit être actif
    await chips[1].trigger('click')
    expect(chips[1].classes()).toContain('text-primary')
    expect(chips[0].classes()).not.toContain('text-primary')
  })

  it('shows generic error when sendOtp rejects without message', async () => {
    sendOtpMock.mockRejectedValueOnce(new Error(''))
    const wrapper = mount(PhoneNumberForm)
    await wrapper.find('input[type="tel"]').setValue('612345678')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Erreur envoi OTP')
  })

  it('disables submit button while loading and shows loading text', async () => {
    let resolveSendOtp!: () => void
    sendOtpMock.mockImplementationOnce(
      () => new Promise<void>(resolve => { resolveSendOtp = resolve }),
    )
    const wrapper = mount(PhoneNumberForm)
    await wrapper.find('input[type="tel"]').setValue('612345678')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    const btn = wrapper.find('button[type="submit"]')
    expect(btn.text()).toContain('Envoi en cours')
    expect(btn.attributes('disabled')).toBeDefined()
    resolveSendOtp()
    await wrapper.vm.$nextTick()
  })
})
