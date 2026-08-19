import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'

describe('bidsAdminService', () => {
  beforeEach(() => apiMock.mockReset())

  it('listBids builds query, omitting TOUS', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await bidsAdminService.listBids({ status: 'COMPLETED', announcementId: null, query: 'b1' }, 0, 20)
    const [url, opts] = apiMock.mock.calls[0]
    expect(url).toBe('/admin/bids')
    expect(opts.query).toMatchObject({ status: 'COMPLETED', query: 'b1', page: 0, size: 20 })
  })
  it('listBids omits TOUS status', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await bidsAdminService.listBids({ status: 'TOUS', announcementId: null, query: '' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.status).toBeUndefined()
  })
  it('getBid GETs detail', async () => {
    apiMock.mockResolvedValue({ id: 'b1' })
    await bidsAdminService.getBid('b1')
    expect(apiMock).toHaveBeenCalledWith('/admin/bids/b1')
  })
  it('getTimeline GETs timeline', async () => {
    apiMock.mockResolvedValue({ bidId: 'b1', entries: [] })
    await bidsAdminService.getTimeline('b1')
    expect(apiMock).toHaveBeenCalledWith('/admin/bids/b1/timeline')
  })
  it('listAnnouncements GETs paged announcements', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await bidsAdminService.listAnnouncements(0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/announcements', { query: { page: 0, size: 20 } })
  })
  it('removeAnnouncement POSTs le motif catalogué ET la note interne, séparément', async () => {
    apiMock.mockResolvedValue({ id: 'a1', status: 'REMOVED_BY_ADMIN' })
    const r = await bidsAdminService.removeAnnouncement('a1', 'SUSPECTED_FRAUD', 'ticket #4821')
    expect(apiMock).toHaveBeenCalledWith('/admin/announcements/a1/remove', { method: 'POST', body: { publicReason: 'SUSPECTED_FRAUD', internalNote: 'ticket #4821' } })
    expect(r.status).toBe('REMOVED_BY_ADMIN')
  })
  it('restoreAnnouncement POSTs without body and returns the updated announcement', async () => {
    apiMock.mockResolvedValue({ id: 'a1', status: 'ACTIVE' })
    const r = await bidsAdminService.restoreAnnouncement('a1')
    expect(apiMock).toHaveBeenCalledWith('/admin/announcements/a1/restore', { method: 'POST' })
    expect(r.status).toBe('ACTIVE')
  })
})
