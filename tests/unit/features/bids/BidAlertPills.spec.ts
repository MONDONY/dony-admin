import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidAlertPills from '@/features/bids/components/BidAlertPills.vue'

const alerts = { disputeOpen: 1, noShow: 0, paymentPending: 5, late: 2 }

describe('BidAlertPills', () => {
  it('affiche quatre pastilles avec leur nombre', () => {
    const w = mount(BidAlertPills, { props: { modelValue: null, alerts } })
    expect(w.findAll('[data-test^="alert-pill-"]')).toHaveLength(4)
    expect(w.find('[data-test="alert-pill-DISPUTE_OPEN"]').text()).toContain('Litige ouvert')
    expect(w.find('[data-test="alert-pill-DISPUTE_OPEN"]').text()).toContain('1')
    expect(w.find('[data-test="alert-pill-PAYMENT_PENDING"]').text()).toContain('5')
    expect(w.find('[data-test="alert-pill-NO_SHOW"]').text()).toContain('0')
  })

  it('un clic choisit l’alerte', async () => {
    const w = mount(BidAlertPills, { props: { modelValue: null, alerts } })
    await w.find('[data-test="alert-pill-LATE"]').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual(['LATE'])
  })

  it('BidAlertPills_toggleOffOnSecondClick : re-cliquer la pastille active désélectionne', async () => {
    const w = mount(BidAlertPills, { props: { modelValue: 'LATE', alerts } })
    expect(w.find('[data-test="alert-pill-LATE"]').attributes('aria-pressed')).toBe('true')
    await w.find('[data-test="alert-pill-LATE"]').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([null])
  })

  it('ne rend rien sans nombres', () => {
    const w = mount(BidAlertPills, { props: { modelValue: null, alerts: null } })
    expect(w.find('[data-test^="alert-pill-"]').exists()).toBe(false)
  })
})
