import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatAmount } from '@/features/finance/types/index'

const fetchMock = vi.fn()
vi.mock('@/features/overview/services/overviewService', () => ({ overviewService: { fetch: (...a: unknown[]) => fetchMock(...a) } }))

import { useOverview } from '@/features/overview/composables/useOverview'

const sample = {
  users: { total: 120, active: 100, suspended: 5, banned: 3, pendingDeletion: 2, kycVerified: 80, kycPending: 10, pro: 7, newLast7d: 4, newLast30d: 20 },
  announcements: { active: 12, full: 2, inProgress: 3, completed: 40, cancelled: 5 },
  bids: { pending: 8, accepted: 15, inTransit: 4, completed: 60, cancelled: 6, total: 93 },
  gmv: { escrowHeld: 1234.56, released: 5000, refunded: 100, commission: 600 },
  gmvByCurrency: [
    { currency: 'EUR', escrowHeldCents: 123456, releasedCents: 500000, refundedCents: 10000, commissionCents: 60000 },
    { currency: 'XOF', escrowHeldCents: 990000, releasedCents: 1980000, refundedCents: 0, commissionCents: 180000 },
  ],
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

  it('derives KPI cards, without any euro total mixing currencies', async () => {
    fetchMock.mockResolvedValue(sample)
    const o = useOverview()
    await o.fetchOverview()
    const ids = o.kpis.value.map(k => k.id)
    expect(ids).toContain('users-total')
    expect(ids).toContain('bids-completed')
    // Recette du 2026-09-09 : ces trois cartes affichaient en euros une somme de toutes les devises.
    expect(ids).not.toContain('gmv-escrow')
    expect(ids).not.toContain('gmv-released')
    expect(ids).not.toContain('gmv-commission')
    expect(o.kpis.value.map(k => k.value).join(' ')).not.toContain('€')
  })

  it('derives one volume row per currency, each amount in its own currency', async () => {
    fetchMock.mockResolvedValue(sample)
    const o = useOverview()
    await o.fetchOverview()
    expect(o.volumes.value.map(v => v.currency)).toEqual(['EUR', 'XOF'])
    const xof = o.volumes.value[1]!
    expect(xof.escrowHeld).toBe(formatAmount(990000, 'XOF'))
    expect(xof.released).toBe(formatAmount(1980000, 'XOF'))
    expect(xof.refunded).toBe(formatAmount(0, 'XOF'))
    expect(xof.commission).toBe(formatAmount(180000, 'XOF'))
    expect(Object.values(xof).join(' ')).not.toContain('€')
    expect(o.volumes.value[0]!.escrowHeld).toBe(formatAmount(123456, 'EUR'))
  })

  it('volumes stays empty when the backend does not send gmvByCurrency yet', async () => {
    const { gmvByCurrency: _omitted, ...oldContract } = sample
    fetchMock.mockResolvedValue(oldContract)
    const o = useOverview()
    await o.fetchOverview()
    expect(o.volumes.value).toEqual([])
    expect(o.kpis.value.length).toBeGreaterThan(0)
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

  it('kpis, volumes et queues sont vides quand data est null (avant premier chargement)', () => {
    const o = useOverview()
    expect(o.kpis.value).toEqual([])
    expect(o.volumes.value).toEqual([])
    expect(o.queues.value).toEqual([])
  })
})
