import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserFilters from '@/features/users/components/UserFilters.vue'

describe('UserFilters', () => {
  it('emits update:status when a chip is clicked', async () => {
    const w = mount(UserFilters, { props: { modelStatus: 'TOUS', modelQuery: '' } })
    await w.find('[data-test="chip-SUSPENDED"]').trigger('click')
    expect(w.emitted('update:status')![0]).toEqual(['SUSPENDED'])
  })
  it('emits update:query on search input enter', async () => {
    const w = mount(UserFilters, { props: { modelStatus: 'TOUS', modelQuery: '' } })
    const input = w.find('[data-test="search"]')
    await input.setValue('jean')
    await input.trigger('keyup.enter')
    expect(w.emitted('update:query')![0]).toEqual(['jean'])
  })
})
