import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/bids/services/bidsAdminService')
import { useAdminBids } from '@/features/bids/composables/useAdminBids'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
const svc = bidsAdminService as any

describe('useAdminBids', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.listBids = vi.fn()
  })
  it('fetchBids loads page', async () => {
    svc.listBids.mockResolvedValue({ content: [{ id: 'b1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const b = useAdminBids(); await b.fetchBids()
    expect(b.bids.value).toHaveLength(1)
  })
  it('setStatusFilter resets page', async () => {
    svc.listBids.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const b = useAdminBids(); await b.goToPage(3); await b.setStatusFilter('COMPLETED')
    expect(b.currentPage.value).toBe(0); expect(b.filters.status).toBe('COMPLETED')
  })
  it('captures errors', async () => {
    svc.listBids.mockRejectedValue(new Error('x'))
    const b = useAdminBids(); await b.fetchBids()
    expect(b.error.value).toBe('x')
  })
})
