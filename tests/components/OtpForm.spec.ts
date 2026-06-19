import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import OtpForm from '@/features/auth/components/OtpForm.vue'

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)

const confirmOtpMock = vi.fn()
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ confirmOtp: confirmOtpMock }),
}))

vi.mock('@/features/auth/components/OtpInput.vue', () => ({
  default: {
    name: 'OtpInput',
    template: '<div data-test="otp-input" />',
    emits: ['complete'],
    expose: ['reset'],
    setup() { return { reset: vi.fn() } },
  },
}))

describe('OtpForm', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigateToMock.mockClear()
    confirmOtpMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the phone number passed as prop', () => {
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    expect(wrapper.text()).toContain('+33612345678')
  })

  it('shows countdown timer', () => {
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    expect(wrapper.text()).toMatch(/\d+s/)
  })

  it('calls confirmOtp when OtpInput emits complete', async () => {
    confirmOtpMock.mockResolvedValue({ roles: ['ADMIN'] })
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    await wrapper.findComponent({ name: 'OtpInput' }).vm.$emit('complete', '123456')
    await flushPromises()
    expect(confirmOtpMock).toHaveBeenCalledWith('123456')
  })

  it('navigates to / after successful admin login', async () => {
    confirmOtpMock.mockResolvedValue({ roles: ['ADMIN'] })
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    await wrapper.findComponent({ name: 'OtpInput' }).vm.$emit('complete', '123456')
    await flushPromises()
    expect(navigateToMock).toHaveBeenCalledWith('/')
  })

  it('navigates to /denied when user is not admin', async () => {
    confirmOtpMock.mockResolvedValue({ roles: ['SENDER'] })
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    await wrapper.findComponent({ name: 'OtpInput' }).vm.$emit('complete', '999999')
    await flushPromises()
    expect(navigateToMock).toHaveBeenCalledWith('/denied')
  })

  it('shows error message on confirmOtp failure', async () => {
    confirmOtpMock.mockRejectedValue(new Error('Code incorrect'))
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    await wrapper.findComponent({ name: 'OtpInput' }).vm.$emit('complete', '000000')
    await flushPromises()
    expect(wrapper.text()).toContain('Code incorrect')
  })

  it('emits resend when resend button clicked (countdown at 0)', async () => {
    vi.useFakeTimers()
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    vi.advanceTimersByTime(60000)
    await wrapper.vm.$nextTick()
    const btn = wrapper.find('[data-test="resend-btn"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(wrapper.emitted('resend')).toBeTruthy()
    vi.useRealTimers()
  })

  it('falls back to "Code incorrect" when error has no message', async () => {
    confirmOtpMock.mockRejectedValue(new Error(''))
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    await wrapper.findComponent({ name: 'OtpInput' }).vm.$emit('complete', '000000')
    await flushPromises()
    expect(wrapper.text()).toContain('Code incorrect')
  })

  it('does not throw when otpInput ref is null on error', async () => {
    confirmOtpMock.mockRejectedValue(new Error('fail'))
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    // Set internal ref to null to test optional chaining (reset() should not crash)
    ;(wrapper.vm as unknown as { otpInput: null }).otpInput = null
    wrapper.findComponent({ name: 'OtpInput' }).vm.$emit('complete', '000000')
    // Wait for the rejected promise to settle
    await vi.runAllTimersAsync()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('fail')
  })

  it('decrements countdown on each tick', async () => {
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    expect((wrapper.vm as unknown as { countdown: number }).countdown).toBe(60)
    vi.advanceTimersByTime(1000)
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { countdown: number }).countdown).toBe(59)
  })

  it('stops timer and shows resend button when countdown reaches 0', async () => {
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    vi.advanceTimersByTime(60000)
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { countdown: number }).countdown).toBe(0)
    expect(wrapper.find('[data-test="resend-btn"]').exists()).toBe(true)
    // One more tick — should not go below 0, timer clears itself
    vi.advanceTimersByTime(1000)
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { countdown: number }).countdown).toBe(0)
  })

  it('clears timer on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const wrapper = mount(OtpForm, { props: { phone: '+33612345678' } })
    wrapper.unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })
})
