import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidsTable from '@/features/bids/components/BidsTable.vue'

const bids = [{
  id: 'b1',
  status: 'COMPLETED' as const,
  announcementId: 'a1',
  senderName: 'Jean',
  travelerName: 'Awa',
  corridor: 'Paris → Dakar',
  weightKg: 5,
  netEur: 30,
  paymentMethod: 'STRIPE',
  createdAt: '2026-06-01T10:00:00Z'
}]

describe('BidsTable', () => {
  it('renders rows + emits select', async () => {
    const w = mount(BidsTable, { props: { bids, loading: false } })
    expect(w.text()).toContain('Paris → Dakar')
    expect(w.text()).toContain('Livré')
    await w.find('[data-test="bid-row-b1"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['b1'])
  })
  it('empty state', () => {
    expect(mount(BidsTable, { props: { bids: [], loading: false } }).text()).toMatch(/Aucun colis/i)
  })
  it('loading state', () => {
    expect(mount(BidsTable, { props: { bids: [], loading: true } }).text()).toMatch(/Chargement/i)
  })
  it('renders placeholders for missing names', () => {
    const w = mount(BidsTable, { props: { bids: [{ ...bids[0], senderName: null, travelerName: null }], loading: false } })
    expect(w.text()).toContain('— → —')
  })
})
