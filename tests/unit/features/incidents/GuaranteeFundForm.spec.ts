import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GuaranteeFundForm from '@/features/incidents/components/GuaranteeFundForm.vue'

describe('GuaranteeFundForm', () => {
  it('disables submit when amount is 0', () => {
    const w = mount(GuaranteeFundForm)
    expect(w.find('[data-test="gf-submit"]').attributes('disabled')).toBeDefined()
  })
  it('disables submit when amount exceeds 200 €', async () => {
    const w = mount(GuaranteeFundForm)
    await w.find('[data-test="gf-amount"]').setValue('250')
    await w.find('[data-test="gf-reason"]').setValue('perdu')
    expect(w.find('[data-test="gf-submit"]').attributes('disabled')).toBeDefined()
  })
  it('emits submit with cents and reason for a valid amount', async () => {
    const w = mount(GuaranteeFundForm)
    await w.find('[data-test="gf-amount"]').setValue('150')
    await w.find('[data-test="gf-reason"]').setValue('colis perdu')
    await w.find('[data-test="gf-submit"]').trigger('click')
    expect(w.emitted('submit')![0]).toEqual([15000, 'colis perdu'])
  })
})
