import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentViewTabs from '@/features/payments/components/PaymentViewTabs.vue'
import type { PaymentViewCounts } from '@/features/payments/types/index'

const counts: PaymentViewCounts = {
  attention: 5, escrow: 41, releasedRecent: 12, refunded: 3, failed: 7, all: 300, abandoned: 2,
  alerts: { held: 1, chargebackOpen: 2, mmFailed: 3, escrowJ48: 4 },
}

describe('PaymentViewTabs', () => {
  it('six vues dans l’ordre, avec leurs nombres, et émet la vue choisie', async () => {
    const w = mount(PaymentViewTabs, { props: { modelValue: 'ATTENTION', counts } })
    const ids = w.findAll('button[data-tab-id]').map(b => b.attributes('data-tab-id'))
    expect(ids).toEqual(['ATTENTION', 'ESCROW', 'RELEASED_RECENT', 'REFUNDED', 'FAILED', 'ALL'])
    expect(w.text()).toContain('Versés (3 j)')
    expect(w.find('[data-test="payment-view-ESCROW"]').text()).toContain('41')
    await w.find('[data-test="payment-view-ALL"]').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual(['ALL'])
  })

  it('« À traiter » rouge s’il reste du travail, son 0 reste visible et neutre', () => {
    const red = mount(PaymentViewTabs, { props: { modelValue: 'ALL', counts } })
    expect(red.find('[data-test="payment-view-ATTENTION"] [data-test="tab-count"]').classes()).toContain('text-danger')
    const zero = mount(PaymentViewTabs, { props: { modelValue: 'ALL', counts: { ...counts, attention: 0, refunded: 0 } } })
    const c = zero.find('[data-test="payment-view-ATTENTION"] [data-test="tab-count"]')
    expect(c.text()).toBe('0')
    expect(c.classes()).not.toContain('text-danger')
    expect(zero.find('[data-test="payment-view-REFUNDED"] [data-test="tab-count"]').exists()).toBe(false)
  })

  it('sans counts : aucun nombre, aucun message de recoupement', () => {
    const w = mount(PaymentViewTabs, { props: { modelValue: 'ALL', counts: null } })
    expect(w.findAll('[data-test="tab-count"]')).toHaveLength(0)
    expect(w.find('[data-test="payment-view-help"]').exists()).toBe(false)
  })

  it('avec counts : rappelle que les nombres se recoupent', () => {
    const w = mount(PaymentViewTabs, { props: { modelValue: 'ALL', counts } })
    expect(w.find('[data-test="payment-view-help"]').text()).toContain('se recoupent')
  })
})
