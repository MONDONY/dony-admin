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
  it('search et setDateRange reviennent à la première page', async () => {
    svc.listBids.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const b = useAdminBids()
    await b.goToPage(2); await b.search('DON-8ANH6EZR')
    expect(b.filters.query).toBe('DON-8ANH6EZR'); expect(b.currentPage.value).toBe(0)
    await b.goToPage(2); await b.setDateRange('2026-10-01', '2026-10-31')
    expect(b.filters.dateFrom).toBe('2026-10-01'); expect(b.filters.dateTo).toBe('2026-10-31'); expect(b.currentPage.value).toBe(0)
  })

  const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
  it('setView_resetsPageAndReloads', async () => {
    svc.listBids.mockResolvedValue(emptyPage)
    const b = useAdminBids(); await b.goToPage(3); await b.setView('ACTIVE')
    expect(b.filters.view).toBe('ACTIVE'); expect(b.currentPage.value).toBe(0)
    expect(svc.listBids).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'ACTIVE' }), 0, 20)
  })
  it('setView_todo_clearsStatusAndAlert', async () => {
    svc.listBids.mockResolvedValue(emptyPage)
    const b = useAdminBids(); await b.setStatusFilter('COMPLETED'); await b.setAlert('LATE')
    await b.setView('TODO')
    expect(b.filters.status).toBe('TOUS'); expect(b.filters.alert).toBeNull()
  })
  it('setters_sendFilterToService', async () => {
    svc.listBids.mockResolvedValue(emptyPage)
    const b = useAdminBids()
    await b.setScope('SENDER'); await b.setPaymentMethod('CASH'); await b.setContent('livres'); await b.setAlert('NO_SHOW')
    expect(svc.listBids).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'SENDER', paymentMethod: 'CASH', content: 'livres', alert: 'NO_SHOW' }), 0, 20)
  })
  it('resetFilters_keepsTripFilter', async () => {
    svc.listBids.mockResolvedValue(emptyPage)
    const b = useAdminBids()
    await b.setAnnouncementFilter('ann-1'); await b.setView('CLOSED'); await b.search('x'); await b.setScope('TRIP')
    await b.setPaymentMethod('CASH'); await b.setContent('c'); await b.setAlert('LATE'); await b.setDateRange('2026-10-01', '2026-10-02'); await b.goToPage(2)
    await b.resetFilters()
    expect(b.filters).toMatchObject({ status: 'TOUS', announcementId: 'ann-1', query: '', scope: 'ALL', view: 'ALL', paymentMethod: null, content: '', alert: null, dateFrom: null, dateTo: null })
    expect(b.currentPage.value).toBe(0)
    expect(svc.listBids).toHaveBeenCalledTimes(10)
  })
  it('fetchBids_ignoresStaleResponse', async () => {
    let resolveFirst!: (_v: unknown) => void
    svc.listBids.mockReturnValueOnce(new Promise(r => { resolveFirst = r }))
    svc.listBids.mockResolvedValueOnce({ ...emptyPage, content: [{ id: 'new' }] })
    const b = useAdminBids()
    const first = b.fetchBids(); const second = b.fetchBids()
    await second
    resolveFirst({ ...emptyPage, content: [{ id: 'old' }] }); await first
    expect(b.bids.value).toEqual([{ id: 'new' }]); expect(b.isLoading.value).toBe(false)
  })
  it('fetchBids_error_setsMessage', async () => {
    svc.listBids.mockRejectedValue(new Error('boom'))
    const b = useAdminBids(); await b.fetchBids()
    expect(b.error.value).toBe('boom'); expect(b.isLoading.value).toBe(false)
  })

  it('search_fromTodo_switchesToAll_oneFetch', async () => {
    svc.listBids.mockResolvedValue(emptyPage)
    const b = useAdminBids(); await b.setView('TODO'); svc.listBids.mockClear()
    await b.search('Awa Diop', 'SENDER')
    expect(b.filters).toMatchObject({ view: 'ALL', query: 'Awa Diop', scope: 'SENDER' })
    expect(svc.listBids).toHaveBeenCalledTimes(1)
  })
  it('search_otherView_keepsView_emptySearch_keepsAll', async () => {
    svc.listBids.mockResolvedValue(emptyPage)
    const b = useAdminBids(); await b.setView('ACTIVE')
    await b.search('Awa')
    expect(b.filters.view).toBe('ACTIVE'); expect(b.filters.scope).toBe('ALL')
    await b.setView('TODO'); await b.search('')
    expect(b.filters.view).toBe('TODO')
  })
  it('setScope_emptyQuery_noReload', async () => {
    svc.listBids.mockResolvedValue(emptyPage)
    const b = useAdminBids(); await b.setView('TODO'); svc.listBids.mockClear()
    await b.setScope('TRIP')
    expect(b.filters.scope).toBe('TRIP'); expect(b.filters.view).toBe('TODO')
    expect(svc.listBids).not.toHaveBeenCalled()
    b.filters.query = 'Paris'
    await b.setScope('SENDER')
    expect(b.filters.view).toBe('ALL'); expect(svc.listBids).toHaveBeenCalledTimes(1)
  })
})
