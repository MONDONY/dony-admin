import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromoTable from '@/features/promo/components/PromoTable.vue'

const codes = [
  {
    id: 'p1', code: 'WELCOME10', rate: 0.1, target: 'ANY' as const,
    validFrom: null, validTo: '2026-12-31T00:00:00Z', maxRedemptions: 100,
    perUserLimit: 1, redeemedCount: 12, status: 'ACTIVE' as const, createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'p2', code: 'FLAT5', rate: 0.05, target: 'SENDER' as const,
    validFrom: null, validTo: null, maxRedemptions: null,
    perUserLimit: 1, redeemedCount: 0, status: 'DISABLED' as const, createdAt: '2026-06-02T10:00:00Z',
  },
]

describe('PromoTable', () => {
  it('renders codes with formatted rate and target', () => {
    const w = mount(PromoTable, { props: { codes, loading: false } })
    expect(w.find('[data-test="promo-row-p1"]').exists()).toBe(true)
    expect(w.text()).toContain('WELCOME10')
    expect(w.text()).toContain('10 %')
    expect(w.text()).toContain('Expéditeurs')
  })

  it('shows redemption progress', () => {
    const w = mount(PromoTable, { props: { codes, loading: false } })
    expect(w.find('[data-test="promo-row-p1"]').text()).toContain('12 / 100')
  })

  it('emits edit, remove and toggleStatus', async () => {
    const w = mount(PromoTable, { props: { codes, loading: false } })
    await w.find('[data-test="edit-p1"]').trigger('click')
    expect(w.emitted('edit')![0]).toEqual(['p1'])
    await w.find('[data-test="remove-p1"]').trigger('click')
    expect(w.emitted('remove')![0]).toEqual(['p1'])
    await w.find('[data-test="toggle-p1"]').trigger('click')
    expect(w.emitted('toggleStatus')![0][0]).toMatchObject({ id: 'p1' })
  })

  it('empty state', () => {
    expect(mount(PromoTable, { props: { codes: [], loading: false } }).text()).toMatch(/Aucun code/i)
  })
})
