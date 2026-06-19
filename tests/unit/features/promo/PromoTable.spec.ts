import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromoTable from '@/features/promo/components/PromoTable.vue'

const codes = [
  { id: 'p1', code: 'WELCOME10', type: 'PERCENT', value: 10, maxRedemptions: 100, redemptionCount: 12, expiresAt: '2026-12-31T00:00:00Z', active: true, createdAt: '2026-06-01T10:00:00Z' },
  { id: 'p2', code: 'FLAT5', type: 'FIXED_AMOUNT', value: 500, maxRedemptions: null, redemptionCount: 0, expiresAt: null, active: false, createdAt: '2026-06-02T10:00:00Z' },
]

describe('PromoTable', () => {
  it('renders codes with formatted value', () => {
    const w = mount(PromoTable, { props: { codes, loading: false } })
    expect(w.find('[data-test="promo-row-p1"]').exists()).toBe(true)
    expect(w.text()).toContain('WELCOME10')
    expect(w.text()).toContain('10 %')
    expect(w.text()).toContain('5,00 €')
  })

  it('shows redemption progress', () => {
    const w = mount(PromoTable, { props: { codes, loading: false } })
    expect(w.find('[data-test="promo-row-p1"]').text()).toContain('12 / 100')
  })

  it('emits edit and remove', async () => {
    const w = mount(PromoTable, { props: { codes, loading: false } })
    await w.find('[data-test="edit-p1"]').trigger('click')
    expect(w.emitted('edit')![0]).toEqual(['p1'])
    await w.find('[data-test="remove-p1"]').trigger('click')
    expect(w.emitted('remove')![0]).toEqual(['p1'])
  })

  it('empty state', () => {
    expect(mount(PromoTable, { props: { codes: [], loading: false } }).text()).toMatch(/Aucun code/i)
  })
})
