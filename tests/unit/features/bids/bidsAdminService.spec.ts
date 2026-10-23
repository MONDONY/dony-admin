import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { BidsFilterState } from '@/features/bids/types/index'

const UUID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const baseFilters = (over: Partial<BidsFilterState> = {}): BidsFilterState => ({
  status: 'TOUS', announcementId: null, query: '', scope: 'ALL', view: 'ALL', paymentMethod: null, content: '', alert: null, dateFrom: null, dateTo: null, ...over,
})

describe('bidsAdminService', () => {
  beforeEach(() => apiMock.mockReset())

  it('listBids builds query, omitting TOUS', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await bidsAdminService.listBids(baseFilters({ status: 'COMPLETED', query: 'b1' }), 0, 20)
    const [url, opts] = apiMock.mock.calls[0]
    expect(url).toBe('/admin/bids')
    expect(opts.query).toMatchObject({ status: 'COMPLETED', query: 'b1', page: 0, size: 20 })
  })
  it('listBids omits TOUS status', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await bidsAdminService.listBids(baseFilters(), 0, 20)
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
  it('getBid et getTimeline encodent l’identifiant : pas de traversée de chemin', async () => {
    await bidsAdminService.getBid('../../admin/x')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/bids/..%2F..%2Fadmin%2Fx')
    await bidsAdminService.getTimeline('a/b')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/bids/a%2Fb/timeline')
  })
  it('listAnnouncements GETs paged announcements', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await bidsAdminService.listAnnouncements(0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/announcements', { query: { page: 0, size: 20 } })
  })
  it('listAnnouncements avec un identifiant : l’annonce du colis seule', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await bidsAdminService.listAnnouncements(0, 20, 'an1')
    expect(apiMock).toHaveBeenCalledWith('/admin/announcements', { query: { page: 0, size: 20, id: 'an1' } })
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

  it('listBids_sendsNewParams_andOmitsDefaults', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await bidsAdminService.listBids(baseFilters(), 0, 20)
    const q = apiMock.mock.calls[0][1].query
    for (const k of ['view', 'scope', 'paymentMethod', 'content', 'alert']) expect(q).not.toHaveProperty(k)
    await bidsAdminService.listBids(baseFilters({ view: 'TODO', scope: 'SENDER', paymentMethod: 'CASH', content: '  vêtements ', alert: 'LATE' }), 1, 20)
    expect(apiMock.mock.calls[1][1].query).toMatchObject({ view: 'TODO', scope: 'SENDER', paymentMethod: 'CASH', content: 'vêtements', alert: 'LATE', page: 1 })
    await bidsAdminService.listBids(baseFilters({ content: '   ' }), 0, 20)
    expect(apiMock.mock.calls[2][1].query).not.toHaveProperty('content')
  })
  it('listBids_stillSendsLegacyParams', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await bidsAdminService.listBids(baseFilters({ status: 'ACCEPTED', announcementId: 'an1', query: ' abc ', dateFrom: '2026-10-01', dateTo: '2026-10-02' }), 2, 50)
    expect(apiMock.mock.calls[0][1].query).toEqual({ page: 2, size: 50, status: 'ACCEPTED', announcementId: 'an1', query: 'abc', dateFrom: '2026-10-01T00:00:00', dateTo: '2026-10-02T23:59:59' })
  })
  it('counts_sendsFiltersWithoutViewStatusAlert', async () => {
    apiMock.mockResolvedValue({ todo: 1, active: 2, recent: 3, completed: 4, closed: 5, all: 6, alerts: { disputeOpen: 1, noShow: 2, paymentPending: 3, late: 4 } })
    const r = await bidsAdminService.counts(baseFilters({ view: 'TODO', status: 'ACCEPTED', alert: 'LATE', query: 'x', scope: 'TRIP', paymentMethod: 'CASH', content: ' c ', announcementId: 'an1', dateFrom: '2026-10-01' }))
    const [url, opts] = apiMock.mock.calls[0]
    expect(url).toBe('/admin/bids/counts')
    expect(opts.query).toEqual({ query: 'x', scope: 'TRIP', paymentMethod: 'CASH', content: 'c', announcementId: 'an1', dateFrom: '2026-10-01T00:00:00' })
    expect(r.alerts.late).toBe(4)
  })
  it('counts_normalizesMissingAlerts', async () => {
    apiMock.mockResolvedValue({ todo: 1, active: 2, recent: 3, completed: 4, closed: 5, all: 6 })
    const r = await bidsAdminService.counts(baseFilters())
    expect(r.alerts).toEqual({ disputeOpen: 0, noShow: 0, paymentPending: 0, late: 0 })
    expect(r.all).toBe(6)
  })
  it('suggest_trimsQuery', async () => {
    apiMock.mockResolvedValue({})
    await bidsAdminService.suggest('  a&b=c  ')
    const [url, opts] = apiMock.mock.calls[0]
    expect(url).toBe('/admin/bids/suggest')
    expect(opts.query).toEqual({ q: 'a&b=c' })
  })
  it('suggest_normalizesMissingGroups', async () => {
    apiMock.mockResolvedValue({ senders: [{ id: 'u1', name: 'A', count: 2 }] })
    const r = await bidsAdminService.suggest('ab')
    expect(r.senders).toHaveLength(1)
    expect([r.travelers, r.recipients, r.trips, r.parcels]).toEqual([[], [], [], []])
  })
  it('photos_rejectsNonUuid', async () => {
    await expect(bidsAdminService.photos('../x')).rejects.toThrow('Identifiant de colis invalide')
    expect(apiMock).not.toHaveBeenCalled()
  })
  it('photos_normalizesMissingList', async () => {
    apiMock.mockResolvedValue({ bidId: UUID })
    const r = await bidsAdminService.photos(UUID)
    expect(apiMock).toHaveBeenCalledWith(`/admin/bids/${UUID}/photos`)
    expect(r).toEqual({ bidId: UUID, photos: [] })
  })
})
