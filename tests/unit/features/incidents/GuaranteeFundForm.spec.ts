import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GuaranteeFundForm from '@/features/incidents/components/GuaranteeFundForm.vue'

const parties = { senderId: 's1', travelerId: 't1', senderName: 'Jean', travelerName: 'Awa' }

describe('GuaranteeFundForm', () => {
  it('disables submit when amount is 0', () => {
    const w = mount(GuaranteeFundForm, { props: { currency: 'EUR', ...parties } })
    expect(w.find('[data-test="gf-submit"]').attributes('disabled')).toBeDefined()
  })
  it('disables submit when amount exceeds 200 € in EUR', async () => {
    const w = mount(GuaranteeFundForm, { props: { currency: 'EUR', ...parties } })
    await w.find('[data-test="gf-amount"]').setValue('250')
    await w.find('[data-test="gf-reason"]').setValue('perdu')
    await w.find('[data-test="gf-beneficiary-sender"]').setValue(true)
    expect(w.find('[data-test="gf-submit"]').attributes('disabled')).toBeDefined()
  })
  it('emits submit with cents, beneficiary and reason for a valid amount', async () => {
    const w = mount(GuaranteeFundForm, { props: { currency: 'EUR', ...parties } })
    await w.find('[data-test="gf-amount"]').setValue('150')
    await w.find('[data-test="gf-reason"]').setValue('colis perdu')
    await w.find('[data-test="gf-beneficiary-traveler"]').setValue(true)
    await w.find('[data-test="gf-submit"]').trigger('click')
    expect(w.emitted('submit')![0]).toEqual([15000, 't1', 'colis perdu'])
  })
  it('refuse d\'envoyer sans bénéficiaire désigné', async () => {
    const w = mount(GuaranteeFundForm, { props: { currency: 'EUR', ...parties } })
    await w.find('[data-test="gf-amount"]').setValue('150')
    await w.find('[data-test="gf-reason"]').setValue('colis perdu')
    expect(w.find('[data-test="gf-submit"]').attributes('disabled')).toBeDefined()
  })
  // Saisi « en euros » sur un colis en francs CFA, le plafond de 200 bloquait tout versement
  // réaliste : 5 000 XOF valent moins de 8 euros.
  it('en XOF, le plafond suit la devise et le montant est envoyé en XOF', async () => {
    const w = mount(GuaranteeFundForm, { props: { currency: 'XOF', ...parties } })
    expect(w.find('[data-test="gf-currency"]').text()).toBe('XOF')
    expect(w.find('[data-test="gf-max"]').text()).toContain('XOF')
    await w.find('[data-test="gf-amount"]').setValue('5000')
    await w.find('[data-test="gf-reason"]').setValue('colis perdu')
    await w.find('[data-test="gf-beneficiary-sender"]').setValue(true)
    expect(w.find('[data-test="gf-submit"]').attributes('disabled')).toBeUndefined()
    await w.find('[data-test="gf-submit"]').trigger('click')
    expect(w.emitted('submit')![0]).toEqual([500000, 's1', 'colis perdu'])
  })
  it('sans devise connue, prévient et prend l\'euro ; sans partie, explique l\'impasse', () => {
    const w = mount(GuaranteeFundForm)
    expect(w.find('[data-test="gf-currency-unknown"]').exists()).toBe(true)
    expect(w.find('[data-test="gf-currency"]').text()).toBe('EUR')
    expect(w.find('[data-test="gf-no-party"]').exists()).toBe(true)
  })
})
