import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidsTable from '@/features/bids/components/BidsTable.vue'
import { formatMajorAmount } from '@/features/finance/types/index'

const bids = [{
  id: 'b1',
  status: 'COMPLETED' as const,
  announcementId: 'a1',
  senderName: 'Jean',
  travelerName: 'Awa',
  corridor: 'Paris → Dakar',
  weightKg: 5,
  netEur: 30,
  currency: 'EUR',
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
  it('affiche le net dans la devise de la demande, jamais « € » par défaut', () => {
    const w = mount(BidsTable, { props: { bids: [{ ...bids[0], id: 'b2', netEur: 6000, currency: 'XOF' }], loading: false } })
    expect(w.find('[data-test="bid-net-b2"]').text()).toBe(formatMajorAmount(6000, 'XOF'))
    expect(w.find('[data-test="bid-net-b2"]').text()).not.toContain('€')
  })
  it('sans prix négocié, le net est un tiret et non « null € »', () => {
    const w = mount(BidsTable, { props: { bids: [{ ...bids[0], id: 'b3', netEur: null }], loading: false } })
    expect(w.find('[data-test="bid-net-b3"]').text()).toBe('—')
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
