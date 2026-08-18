import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import { seedAuth } from '~/tests/helpers/auth'

const mockPayment = {
  id: 'pay_123',
  status: 'ESCROW',
  bidId: 'bid_456',
  method: 'card',
  amountCents: 10000,
  commissionCents: 1200,
  refundedCents: 0,
  stripePaymentIntentId: 'pi_xxx',
}

describe('PaymentDetailPanel', () => {
  beforeEach(() => seedAuth('ADMIN'))
  it('renders when open prop is true', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: mockPayment,
        open: true,
      },
    })
    expect(wrapper.find('.fixed').exists()).toBe(true)
  })

  it('emits close event on close button', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: mockPayment,
        open: true,
      },
    })
    await wrapper.find('[data-test="payment-close"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('shows action buttons for ESCROW status', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'ESCROW' },
        open: true,
      },
    })
    expect(wrapper.find('[data-test="action-release"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="action-refund"]').exists()).toBe(true)
  })

  it('hides action buttons for non-ESCROW status', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'RELEASED' },
        open: true,
      },
    })
    expect(wrapper.find('[data-test="action-release"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="action-refund"]').exists()).toBe(false)
  })

  it('emits force-release when release confirmed', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'ESCROW' },
        open: true,
      },
    })
    await wrapper.find('[data-test="action-release"]').trigger('click')
    // Simulate dialog confirmation
    const dialog = wrapper.findComponent({ name: 'ConfirmActionDialog' })
    await dialog.vm.$emit('confirm')
    expect(wrapper.emitted('force-release')).toBeTruthy()
  })

  it('emits refund when refund confirmed', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'ESCROW' },
        open: true,
      },
    })
    await wrapper.find('[data-test="action-refund"]').trigger('click')
    const dialog = wrapper.findComponent({ name: 'ConfirmActionDialog' })
    await dialog.vm.$emit('confirm')
    expect(wrapper.emitted('refund')).toBeTruthy()
  })

  it('displays payment details correctly', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: mockPayment,
        open: true,
      },
    })
    expect(wrapper.text()).toContain('bid_456')
    expect(wrapper.text()).toContain('card')
  })

  it('cancels dialog on cancel', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'ESCROW' },
        open: true,
      },
    })
    await wrapper.find('[data-test="action-release"]').trigger('click')
    const dialog = wrapper.findComponent({ name: 'ConfirmActionDialog' })
    await dialog.vm.$emit('cancel')
    expect(wrapper.emitted('force-release')).toBeFalsy()
  })

  it('does not render when open prop is false', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: mockPayment,
        open: false,
      },
    })
    expect(wrapper.find('.fixed').exists()).toBe(false)
  })

  it('closes on backdrop click', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: mockPayment,
        open: true,
      },
    })
    await wrapper.find('.fixed').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
