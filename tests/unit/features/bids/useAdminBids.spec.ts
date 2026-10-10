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

  it('affiche le detail du ProblemDetail plutôt que le message technique', async () => {
    svc.listBids.mockRejectedValue(Object.assign(new Error('500 Internal Server Error'), { data: { detail: 'Détail lisible du back' } }))
    const b = useAdminBids(); await b.fetchBids()
    expect(b.error.value).toBe('Détail lisible du back')
  })
  it('setAnnouncementFilter filtre sur le trajet et revient à la première page', async () => {
    svc.listBids.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const b = useAdminBids()
    b.currentPage.value = 3
    await b.setAnnouncementFilter('ann-1')
    expect(b.filters.announcementId).toBe('ann-1')
    expect(b.currentPage.value).toBe(0)
    expect(svc.listBids).toHaveBeenLastCalledWith(expect.objectContaining({ announcementId: 'ann-1' }), 0, 20)
  })
  it('setSearch et setDateRange reviennent à la première page', async () => {
    svc.listBids.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const b = useAdminBids()
    await b.goToPage(2); await b.setSearch('DON-8ANH6EZR')
    expect(b.filters.query).toBe('DON-8ANH6EZR'); expect(b.currentPage.value).toBe(0)
    await b.goToPage(2); await b.setDateRange('2026-10-01', '2026-10-31')
    expect(b.filters.dateFrom).toBe('2026-10-01'); expect(b.filters.dateTo).toBe('2026-10-31'); expect(b.currentPage.value).toBe(0)
  })
})
