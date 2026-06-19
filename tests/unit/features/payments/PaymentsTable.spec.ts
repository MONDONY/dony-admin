import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentsTable from '@/features/payments/components/PaymentsTable.vue'

const payments = [{ id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 12345, commissionCents: 1480, createdAt: '2026-06-01T10:00:00Z' }]

describe('PaymentsTable', () => {
  it('renders rows with formatted amount + emits select', async () => {
    const w = mount(PaymentsTable, { props: { payments, loading: false } })
    expect(w.text()).toContain('Sous séquestre'); expect(w.text()).toContain('123,45')
    await w.find('[data-test="payment-row-p1"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['p1'])
  })
  it('empty state', () => { expect(mount(PaymentsTable, { props: { payments: [], loading: false } }).text()).toMatch(/Aucun paiement/i) })
})
