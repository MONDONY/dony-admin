import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/bids/services/bidsAdminService')
import { useBidTimeline } from '@/features/bids/composables/useBidTimeline'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
const svc = bidsAdminService as any

describe('useBidTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.getBid = vi.fn()
    svc.getTimeline = vi.fn()
  })
  it('open loads bid + timeline', async () => {
    svc.getBid.mockResolvedValue({ id: 'b1', status: 'COMPLETED' })
    svc.getTimeline.mockResolvedValue({ bidId: 'b1', entries: [{ at: '2026-06-01', kind: 'SCAN', label: 'Départ' }] })
    const t = useBidTimeline(); await t.open('b1')
    expect(t.bid.value?.id).toBe('b1')
    expect(t.timeline.value?.entries).toHaveLength(1)
  })
  it('close clears', async () => {
    svc.getBid.mockResolvedValue({ id: 'b1' }); svc.getTimeline.mockResolvedValue({ bidId: 'b1', entries: [] })
    const t = useBidTimeline(); await t.open('b1'); t.close()
    expect(t.bid.value).toBeNull()
  })
  it('captures errors', async () => {
    svc.getBid.mockRejectedValue(new Error('e'))
    const t = useBidTimeline(); await t.open('b1')
    expect(t.error.value).toBe('e')
  })
})
