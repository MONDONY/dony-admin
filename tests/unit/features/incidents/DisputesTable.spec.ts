import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DisputesTable from '@/features/incidents/components/DisputesTable.vue'

const disputes = [{ id: 'd1', bidId: 'b1', type: 'SENDER_NO_SHOW_CONTESTED', status: 'OPEN' as const, senderName: 'Jean', travelerName: 'Awa', refundFrozen: true, createdAt: '2026-06-01T10:00:00Z' }]

describe('DisputesTable', () => {
  it('renders rows + emits select', async () => {
    const w = mount(DisputesTable, { props: { disputes, loading: false } })
    expect(w.text()).toContain('SENDER_NO_SHOW_CONTESTED'); expect(w.text()).toContain('Ouvert')
    await w.find('[data-test="dispute-row-d1"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['d1'])
  })
  it('empty state', () => { expect(mount(DisputesTable, { props: { disputes: [], loading: false } }).text()).toMatch(/Aucun litige/i) })
})
