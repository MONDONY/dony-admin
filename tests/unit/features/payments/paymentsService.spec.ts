import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { paymentsService } from '@/features/payments/services/paymentsService'

describe('paymentsService', () => {
  beforeEach(() => apiMock.mockReset())
  it('list omits TOUS status/method and TOUTES currency', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await paymentsService.list({ status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null }, 0, 20)
    const q = apiMock.mock.calls[0][1].query
    expect(q.status).toBeUndefined(); expect(q.method).toBeUndefined(); expect(q.currency).toBeUndefined()
  })
  it('list passes status + method + currency', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await paymentsService.list({ status: 'ESCROW', method: 'PAWAPAY', currency: 'XOF', dateFrom: null, dateTo: null }, 1, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ status: 'ESCROW', method: 'PAWAPAY', currency: 'XOF', page: 1, size: 20 })
  })
  it('forceRelease POSTs', async () => {
    apiMock.mockResolvedValue({ id: 'p1', status: 'RELEASED' })
    await paymentsService.forceRelease('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/payments/p1/force-release', { method: 'POST' })
  })
  it('resyncStripe POSTs sans corps', async () => {
    apiMock.mockResolvedValue({ action: 'ALREADY_IN_SYNC' })
    await paymentsService.resyncStripe('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/payments/p1/resync-stripe', { method: 'POST' })
  })
  it('refund POSTs', async () => {
    apiMock.mockResolvedValue({ id: 'p1', status: 'REFUNDED' })
    await paymentsService.refund('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/payments/p1/refund', { method: 'POST' })
  })
  it('listChargebacks GETs paged', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await paymentsService.listChargebacks(0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/chargebacks', { query: { page: 0, size: 20 } })
  })
  it('retryMobileMoneyPayout POSTs la relance de versement', async () => {
    apiMock.mockResolvedValue({ id: 'p1', status: 'RELEASED' })
    await paymentsService.retryMobileMoneyPayout('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/payments/p1/mobile-money/retry-payout', { method: 'POST' })
  })
  it('retryMobileMoneyRefund POSTs la relance de remboursement', async () => {
    apiMock.mockResolvedValue({ id: 'p1', status: 'REFUNDED' })
    await paymentsService.retryMobileMoneyRefund('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/payments/p1/mobile-money/retry-refund', { method: 'POST' })
  })

  const base = { status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null } as const

  it('list n\'envoie aucun nouveau paramètre à sa valeur par défaut', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await paymentsService.list({ ...base, view: 'ALL', alert: null, partyId: '', announcementId: '', bidId: '', amountMin: null, amountMax: null }, 0, 20)
    expect(apiMock.mock.calls[0][1].query).toEqual({ page: 0, size: 20 })
  })
  it('list envoie vue, alerte, parties, annonce, colis et montants en centimes', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await paymentsService.list({ ...base, view: 'ATTENTION', alert: 'HELD', partyId: 'u1', announcementId: 'a1', bidId: 'b1', amountMin: 12000, amountMax: 0 }, 0, 20)
    expect(apiMock.mock.calls[0][1].query).toEqual({
      view: 'ATTENTION', alert: 'HELD', partyId: 'u1', announcementId: 'a1', bidId: 'b1', amountMin: 12000, amountMax: 0, page: 0, size: 20,
    })
  })
  it('summary et exportCsv acceptent les mêmes filtres', async () => {
    apiMock.mockResolvedValue([])
    const f = { ...base, view: 'ESCROW', partyId: 'u1', amountMin: 500, dateFrom: '2026-10-01', dateTo: '2026-10-02' } as const
    await paymentsService.summary(f)
    await paymentsService.exportCsv(f)
    const expected = { view: 'ESCROW', partyId: 'u1', amountMin: 500, dateFrom: '2026-10-01T00:00:00', dateTo: '2026-10-02T23:59:59' }
    expect(apiMock.mock.calls[0][1].query).toEqual(expected)
    expect(apiMock.mock.calls[1][1].query).toEqual(expected)
  })
  it('counts n\'envoie ni vue, ni alerte, ni statut, et normalise le groupe d\'alertes absent', async () => {
    apiMock.mockResolvedValue({ attention: 3, escrow: 1, releasedRecent: 0, refunded: 0, failed: 0, all: 9, abandoned: 2 })
    const r = await paymentsService.counts({ ...base, status: 'ESCROW', view: 'FAILED', alert: 'HELD', method: 'STRIPE', query: ' pi_1 ', partyId: 'u1', amountMax: 900 })
    expect(apiMock.mock.calls[0][0]).toBe('/admin/payments/counts')
    expect(apiMock.mock.calls[0][1].query).toEqual({ method: 'STRIPE', q: 'pi_1', partyId: 'u1', amountMax: 900 })
    expect(r.attention).toBe(3)
    expect(r.alerts).toEqual({ held: 0, chargebackOpen: 0, mmFailed: 0, escrowJ48: 0 })
  })
  it('counts garde les alertes renvoyées (non exclusives)', async () => {
    apiMock.mockResolvedValue({ attention: 1, escrow: 1, releasedRecent: 0, refunded: 0, failed: 0, all: 1, abandoned: 0, alerts: { held: 1, chargebackOpen: 0, mmFailed: 0, escrowJ48: 1 } })
    const r = await paymentsService.counts(base)
    expect(r.alerts).toEqual({ held: 1, chargebackOpen: 0, mmFailed: 0, escrowJ48: 1 })
  })
  it('suggest rogne la saisie et ramène les groupes absents à []', async () => {
    apiMock.mockResolvedValue({ exactPaymentId: 'p9', parcels: [{ paymentId: 'p9', trackingNumber: 'T1', status: 'ESCROW', amountCents: 100, currency: 'EUR' }] })
    const r = await paymentsService.suggest('  dakar ')
    expect(apiMock).toHaveBeenCalledWith('/admin/payments/suggest', { query: { q: 'dakar' } })
    expect(r).toEqual({ exactPaymentId: 'p9', senders: [], travelers: [], trips: [], parcels: [expect.objectContaining({ trackingNumber: 'T1' })] })
  })
  it('suggest sans exactPaymentId le laisse absent', async () => {
    apiMock.mockResolvedValue({})
    const r = await paymentsService.suggest('ab')
    expect(r.exactPaymentId).toBeUndefined()
    expect(r.senders).toEqual([])
  })
  it('listChargebacks accepte aussi des paramètres (vue, recherche) et omet les défauts', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await paymentsService.listChargebacks({ view: 'OPEN', q: ' dakar ', page: 2, size: 10 })
    expect(apiMock).toHaveBeenCalledWith('/admin/chargebacks', { query: { view: 'OPEN', q: 'dakar', page: 2, size: 10 } })
    apiMock.mockClear()
    await paymentsService.listChargebacks({ view: 'ALL', q: '' })
    expect(apiMock).toHaveBeenCalledWith('/admin/chargebacks', { query: { page: 0, size: 20 } })
  })
  it('chargebackCounts GETe les nombres avec la recherche', async () => {
    apiMock.mockResolvedValue({ open: 1, won: 0, lost: 0, all: 1 })
    await paymentsService.chargebackCounts(' x ')
    expect(apiMock).toHaveBeenCalledWith('/admin/chargebacks/counts', { query: { q: 'x' } })
    apiMock.mockClear()
    await paymentsService.chargebackCounts()
    expect(apiMock).toHaveBeenCalledWith('/admin/chargebacks/counts', { query: {} })
  })
})
