import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchMock = vi.fn()
vi.mock('@/features/overview/services/overviewService', () => ({ overviewService: { fetch: (...a: unknown[]) => fetchMock(...a) } }))

import { useOverview } from '@/features/overview/composables/useOverview'

const sample = {
  users: { total: 120, active: 100, suspended: 5, banned: 3, pendingDeletion: 2, kycVerified: 80, kycPending: 10, pro: 7, newLast7d: 4, newLast30d: 20 },
  trips: { active: 12, inProgress: 3, completed: 40, cancelled: 5 },
  bids: { pending: 8, accepted: 15, inTransit: 4, completed: 60, cancelled: 6, total: 93 },
  gmv: { escrowHeldCents: 123456, releasedCents: 500000, refundedCents: 10000, commissionCents: 60000 },
  queues: { openDisputes: 2, pendingNoShows: 1, unresolvedAlerts: 3, pendingKyc: 10, escrowJ48: 1 },
}

describe('useOverview', () => {
  beforeEach(() => fetchMock.mockReset())

  it('fetchOverview loads data', async () => {
    fetchMock.mockResolvedValue(sample)
    const o = useOverview()
    await o.fetchOverview()
    expect(o.data.value?.users.total).toBe(120)
    expect(o.isLoading.value).toBe(false)
  })

  it('derives KPI cards including formatted GMV', async () => {
    fetchMock.mockResolvedValue(sample)
    const o = useOverview()
    await o.fetchOverview()
    const ids = o.kpis.value.map(k => k.id)
    expect(ids).toContain('users-total')
    expect(ids).toContain('gmv-escrow')
    const escrow = o.kpis.value.find(k => k.id === 'gmv-escrow')!
    expect(escrow.value).toContain('€')
    expect(escrow.value).toContain('234') // 123456 cents -> 1 234,56 €
  })

  it('derives queue cards with counts and tones', async () => {
    fetchMock.mockResolvedValue(sample)
    const o = useOverview()
    await o.fetchOverview()
    const disputes = o.queues.value.find(q => q.id === 'disputes')!
    expect(disputes.count).toBe(2)
    expect(disputes.tone).toBe('danger')
  })

  it('captures errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down'))
    const o = useOverview()
    await o.fetchOverview()
    expect(o.error.value).toBe('down')
  })
})
