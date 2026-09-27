import { describe, it, expect, vi } from 'vitest'

const fetchMock = vi.fn()
vi.mock('@/features/overview/services/overviewService', () => ({ overviewService: { fetch: (...a: unknown[]) => fetchMock(...a) } }))

import { useOverview } from '@/features/overview/composables/useOverview'

const sample = {
  users: { total: 1, active: 1, suspended: 0, banned: 0, pendingDeletion: 0, kycVerified: 0, kycPending: 0, pro: 0, newLast7d: 0, newLast30d: 0 },
  announcements: { active: 0, full: 0, inProgress: 0, completed: 0, cancelled: 0 },
  bids: { pending: 0, accepted: 0, inTransit: 0, completed: 0, cancelled: 0, total: 0 },
  gmv: { escrowHeld: 0, released: 0, refunded: 0, commission: 0 },
  queues: { openDisputes: 0, pendingNoShows: 0, unresolvedAlerts: 0, escrowJ48: 0 },
}

describe('useOverview : carte Versements retenus', () => {
  it('présente si queues.heldPayouts est envoyé, vers Transactions filtré', async () => {
    fetchMock.mockResolvedValue({ ...sample, queues: { ...sample.queues, heldPayouts: 3 } })
    const o = useOverview()
    await o.fetchOverview()
    const card = o.queues.value.find(q => q.id === 'heldPayouts')
    expect(card).toEqual({ id: 'heldPayouts', label: 'Versements retenus', count: 3, tone: 'danger', href: '/transactions?held=true' })
  })

  it('présente aussi à zéro', async () => {
    fetchMock.mockResolvedValue({ ...sample, queues: { ...sample.queues, heldPayouts: 0 } })
    const o = useOverview()
    await o.fetchOverview()
    expect(o.queues.value.find(q => q.id === 'heldPayouts')?.count).toBe(0)
  })

  it('ancien back : aucune carte', async () => {
    fetchMock.mockResolvedValue(sample)
    const o = useOverview()
    await o.fetchOverview()
    expect(o.queues.value.find(q => q.id === 'heldPayouts')).toBeUndefined()
  })
})
