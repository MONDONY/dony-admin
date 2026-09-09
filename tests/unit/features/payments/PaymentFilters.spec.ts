import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentFilters from '@/features/payments/components/PaymentFilters.vue'

function mountFilters(props = {}) {
  return mount(PaymentFilters, {
    props: {
      modelStatus: 'TOUS',
      modelMethod: 'TOUS',
      modelCurrency: 'TOUTES',
      modelDateFrom: null,
      modelDateTo: null,
      ...props,
    },
  })
}

describe('PaymentFilters', () => {
  it('emits status and method changes', async () => {
    const wrapper = mountFilters()

    await wrapper.find('[data-test="chip-status-RELEASED"]').trigger('click')
    await wrapper.find('[data-test="chip-method-STRIPE"]').trigger('click')

    expect(wrapper.emitted('update:status')?.[0]).toEqual(['RELEASED'])
    expect(wrapper.emitted('update:method')?.[0]).toEqual(['STRIPE'])
  })

  it('émet le filtre de devise, et ne propose que les deux rails réels comme méthode', async () => {
    const wrapper = mountFilters()

    await wrapper.find('[data-test="chip-currency-XOF"]').trigger('click')
    expect(wrapper.emitted('update:currency')?.[0]).toEqual(['XOF'])

    await wrapper.find('[data-test="chip-method-PAWAPAY"]').trigger('click')
    expect(wrapper.emitted('update:method')?.[0]).toEqual(['PAWAPAY'])
    // Cash, Wave et Orange Money envoyaient des valeurs sans rail : toujours une liste vide.
    expect(wrapper.find('[data-test="chip-method-WAVE"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chip-method-ORANGE_MONEY"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chip-method-CASH"]').exists()).toBe(false)
  })

  it('emits date range updates and clears them', async () => {
    const wrapper = mountFilters({ modelDateFrom: '2026-06-01' })

    await wrapper.find('[data-test="date-from"]').setValue('2026-06-01')
    await wrapper.find('[data-test="date-to"]').setValue('2026-06-30')
    await wrapper.findAll('button').at(-1)!.trigger('click')

    expect(wrapper.emitted('update:dateRange')?.[0]).toEqual(['2026-06-01', null])
    expect(wrapper.emitted('update:dateRange')?.[1]).toEqual(['2026-06-01', '2026-06-30'])
    expect(wrapper.emitted('update:dateRange')?.[2]).toEqual([null, null])
  })
})
