import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/payments/services/paymentsService')
import { usePayments } from '@/features/payments/composables/usePayments'
import { paymentsService } from '@/features/payments/services/paymentsService'
const svc = paymentsService as any

describe('usePayments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn()
  })
  it('fetchPayments loads page', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'p1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const p = usePayments(); await p.fetchPayments()
    expect(p.payments.value).toHaveLength(1)
  })
  it('setStatusFilter resets page', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = usePayments(); await p.goToPage(2); await p.setStatusFilter('ESCROW')
    expect(p.currentPage.value).toBe(0); expect(p.filters.status).toBe('ESCROW')
  })
  it('captures errors', async () => {
    const err = new Error('x')
    svc.list.mockRejectedValue(err)
    const p = usePayments()
    await p.fetchPayments()
    expect(p.error.value).toBe('x')
  })

  it('affiche le detail du ProblemDetail plutôt que le message technique', async () => {
    const err = Object.assign(new Error('500 Internal Server Error'), { data: { detail: 'Détail lisible du back' } })
    svc.list.mockRejectedValue(err)
    const p = usePayments()
    await p.fetchPayments()
    expect(p.error.value).toBe('Détail lisible du back')
  })

  it('setMethodFilter réinitialise la page et filtre par méthode', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = usePayments()
    await p.goToPage(3)
    await p.setMethodFilter('STRIPE')
    expect(p.currentPage.value).toBe(0)
    expect(p.filters.method).toBe('STRIPE')
    expect(svc.list).toHaveBeenCalled()
  })

  it('setCurrencyFilter réinitialise la page et sépare les devises', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = usePayments()
    expect(p.filters.currency).toBe('TOUTES')
    await p.goToPage(2)
    await p.setCurrencyFilter('XOF')
    expect(p.currentPage.value).toBe(0)
    expect(p.filters.currency).toBe('XOF')
    expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ currency: 'XOF' }), 0, 20)
  })

  it('setDateRange réinitialise la page et applique les dates', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = usePayments()
    await p.goToPage(2)
    await p.setDateRange('2026-01-01', '2026-12-31')
    expect(p.currentPage.value).toBe(0)
    expect(p.filters.dateFrom).toBe('2026-01-01')
    expect(p.filters.dateTo).toBe('2026-12-31')
    expect(svc.list).toHaveBeenCalled()
  })

  it('setDateRange accepte des valeurs null (réinitialisation des dates)', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = usePayments()
    await p.setDateRange(null, null)
    expect(p.filters.dateFrom).toBeNull()
    expect(p.filters.dateTo).toBeNull()
  })

  describe('nouveaux filtres', () => {
    const empty = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
    beforeEach(() => { svc.list.mockResolvedValue(empty); svc.summary = vi.fn().mockResolvedValue([]) })

    it('défaut : vue ATTENTION, hideAbandoned, aucun autre filtre', () => {
      const p = usePayments()
      expect(p.filters.view).toBe('ATTENTION'); expect(p.filters.hideAbandoned).toBe(true)
      expect(p.filters.alert ?? null).toBeNull(); expect(p.filters.partyId ?? '').toBe('')
    })
    it('setView remet la page à 0, recharge liste et totaux', async () => {
      const p = usePayments(); await p.goToPage(2); vi.clearAllMocks()
      await p.setView('ESCROW')
      expect(p.currentPage.value).toBe(0); expect(p.filters.view).toBe('ESCROW')
      expect(svc.list).toHaveBeenCalledWith(p.filters, 0, 20); expect(svc.summary).toHaveBeenCalledTimes(1)
    })
    it('setAlert, setParty, setAnnouncement, setBid, setAmountRange', async () => {
      const p = usePayments()
      await p.setAlert('HELD'); expect(p.filters.alert).toBe('HELD')
      await p.setParty('u1'); expect(p.filters.partyId).toBe('u1')
      await p.setParty(null); expect(p.filters.partyId).toBe('')
      await p.setAnnouncement('a1'); expect(p.filters.announcementId).toBe('a1')
      await p.setBid('b1'); expect(p.filters.bidId).toBe('b1')
      await p.setAmountRange(100, null); expect(p.filters.amountMin).toBe(100); expect(p.filters.amountMax).toBeNull()
      expect(p.currentPage.value).toBe(0)
      expect(svc.list).toHaveBeenCalledTimes(6)
    })
    it('clearFilter remet un seul filtre à son défaut', async () => {
      const p = usePayments()
      await p.setParty('u1'); await p.setAmountRange(100, 200); await p.setStatusFilter('ESCROW')
      await p.setDateRange('2026-10-01', '2026-10-02'); await p.setQuery('abc'); await p.setAlert('HELD')
      await p.setAnnouncement('a'); await p.setBid('b'); await p.setMethodFilter('STRIPE'); await p.setCurrencyFilter('EUR')
      await p.clearFilter('party'); expect(p.filters.partyId).toBe('')
      await p.clearFilter('amount'); expect(p.filters.amountMin).toBeNull(); expect(p.filters.amountMax).toBeNull()
      await p.clearFilter('status'); expect(p.filters.status).toBe('TOUS')
      await p.clearFilter('period'); expect(p.filters.dateFrom).toBeNull(); expect(p.filters.dateTo).toBeNull()
      await p.clearFilter('search'); expect(p.filters.query).toBe('')
      await p.clearFilter('alert'); expect(p.filters.alert).toBeNull()
      await p.clearFilter('trip'); expect(p.filters.announcementId).toBe('')
      await p.clearFilter('bid'); expect(p.filters.bidId).toBe('')
      await p.clearFilter('method'); expect(p.filters.method).toBe('TOUS')
      await p.clearFilter('currency'); expect(p.filters.currency).toBe('TOUTES')
    })
    it('clearAll rétablit tous les défauts, dont hideAbandoned et la vue ATTENTION', async () => {
      const p = usePayments()
      await p.setView('ALL'); await p.setHideAbandoned(false); await p.setHeldFilter(true); await p.setParty('u1')
      await p.setAmountRange(1, 2); await p.setQuery('x'); await p.goToPage(3)
      vi.clearAllMocks()
      await p.clearAll()
      expect(p.filters).toMatchObject({ status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null, held: false, query: '', hideAbandoned: true, view: 'ATTENTION', alert: null, partyId: '', announcementId: '', bidId: '', amountMin: null, amountMax: null })
      expect(p.currentPage.value).toBe(0); expect(svc.list).toHaveBeenCalledTimes(1)
    })
    it('sans nouveau filtre (vue ALL), la requête est celle d\'avant', async () => {
      const p = usePayments(); p.filters.view = 'ALL'; await p.fetchPayments()
      expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null, held: false, query: '', hideAbandoned: true, view: 'ALL' }), 0, 20)
    })
  })
})
