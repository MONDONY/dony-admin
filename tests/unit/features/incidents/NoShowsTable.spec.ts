import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NoShowsTable from '@/features/incidents/components/NoShowsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'

const rows = [{ id: 'c1', bidId: 'b1', cancelledBy: 'TRAVELER', reason: 'SENDER_NO_SHOW', noShowStatus: 'PENDING_CONFIRMATION' as const, contestationDeadline: '2026-06-05T10:00:00Z', createdAt: '2026-06-01T10:00:00Z' }]

describe('NoShowsTable', () => {
  beforeEach(() => seedAuth('ADMIN'))
  it('renders rows + emits confirm with bidId', async () => {
    const w = mount(NoShowsTable, { props: { cancellations: rows, loading: false } })
    expect(w.find('[data-test="noshow-row-c1"]').exists()).toBe(true)
    await w.find('[data-test="confirm-noshow-b1"]').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['b1'])
  })
  it('empty state', () => { expect(mount(NoShowsTable, { props: { cancellations: [], loading: false } }).text()).toMatch(/Aucun no-show/i) })
})
