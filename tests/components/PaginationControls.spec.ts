import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaginationControls from '@/components/ui/PaginationControls.vue'

describe('PaginationControls', () => {
  it('shows 1-based page of total', () => {
    expect(mount(PaginationControls, { props: { page: 0, totalPages: 5 } }).text()).toContain('1 / 5')
  })
  it('emits change with next page', async () => {
    const w = mount(PaginationControls, { props: { page: 1, totalPages: 5 } })
    await w.find('[data-test="next"]').trigger('click')
    expect(w.emitted('change')![0]).toEqual([2])
  })
  it('disables prev on first page', () => {
    const w = mount(PaginationControls, { props: { page: 0, totalPages: 5 } })
    expect(w.find('[data-test="prev"]').attributes('disabled')).toBeDefined()
  })
})
