import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserFilters from '@/features/users/components/UserFilters.vue'

describe('UserFilters', () => {
  it('emits status and search query changes', async () => {
    const wrapper = mount(UserFilters, {
      props: { modelStatus: 'TOUS', modelQuery: '' },
    })

    await wrapper.find('[data-test="chip-SUSPENDED"]').trigger('click')
    await wrapper.find('[data-test="search"]').setValue('awa@example.com')
    await wrapper.find('[data-test="search"]').trigger('keyup.enter')

    expect(wrapper.emitted('update:status')?.[0]).toEqual(['SUSPENDED'])
    expect(wrapper.emitted('update:query')?.[0]).toEqual(['awa@example.com'])
  })
})
