import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChargebacksTable from '@/features/payments/components/ChargebacksTable.vue'

const cbs = [{ id: 'cb1', bidId: 'b1', amountCents: 5000, reason: 'fraudulent', status: 'OPEN', openedAt: '2026-06-01T10:00:00Z' }]

describe('ChargebacksTable', () => {
  it('renders rows', () => { expect(mount(ChargebacksTable, { props: { chargebacks: cbs, loading: false } }).find('[data-test="cb-row-cb1"]').exists()).toBe(true) })
  it('empty state', () => { expect(mount(ChargebacksTable, { props: { chargebacks: [], loading: false } }).text()).toMatch(/Aucun litige bancaire/i) })
})
