import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidFilters from '@/features/bids/components/BidFilters.vue'

function mountFilters(props = {}) {
  return mount(BidFilters, {
    props: {
      modelStatus: 'TOUS',
      modelQuery: '',
      modelDateFrom: null,
      modelDateTo: null,
      ...props,
    },
  })
}

describe('BidFilters', () => {
  it('emits status and search query changes', async () => {
    const wrapper = mountFilters()

    await wrapper.find('[data-test="chip-status-COMPLETED"]').trigger('click')
    await wrapper.find('[data-test="search"]').setValue('YD-42')
    await wrapper.find('[data-test="search"]').trigger('keyup.enter')
    await wrapper.find('[data-test="search"]').trigger('search')

    expect(wrapper.emitted('update:status')?.[0]).toEqual(['COMPLETED'])
    expect(wrapper.emitted('update:query')?.[0]).toEqual(['YD-42'])
    expect(wrapper.emitted('update:query')?.[1]).toEqual(['YD-42'])
  })

  it('emits date range updates and clears them', async () => {
    const wrapper = mountFilters({ modelDateTo: '2026-07-31' })

    await wrapper.find('[data-test="date-from"]').setValue('2026-07-01')
    await wrapper.find('[data-test="date-to"]').setValue('2026-07-31')
    await wrapper.findAll('button').at(-1)!.trigger('click')

    expect(wrapper.emitted('update:dateRange')?.[0]).toEqual(['2026-07-01', null])
    expect(wrapper.emitted('update:dateRange')?.[1]).toEqual(['2026-07-01', '2026-07-31'])
    expect(wrapper.emitted('update:dateRange')?.[2]).toEqual([null, null])
  })
})
