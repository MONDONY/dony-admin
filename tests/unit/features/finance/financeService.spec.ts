import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { financeService } from '@/features/finance/services/financeService'

describe('financeService', () => {
  beforeEach(() => apiMock.mockReset())

  it('listWallets GETe une page de portefeuilles', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await financeService.listWallets({})
    expect(apiMock).toHaveBeenCalledWith('/admin/wallets', { query: { page: 0, size: 20 } })
  })

  it('listWallets transmet la page et la taille demandées', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 2, size: 10 })
    await financeService.listWallets({ page: 2, size: 10 })
    expect(apiMock.mock.calls[0][1].query).toEqual({ page: 2, size: 10 })
  })

  it('listMobileMoneyPayments GETe une page de paiements mobile money', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await financeService.listMobileMoneyPayments({})
    expect(apiMock).toHaveBeenCalledWith('/admin/mobile-money-payments', { query: { page: 0, size: 20 } })
  })

  it('listMobileMoneyPayments transmet la page demandée', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 1, size: 20 })
    await financeService.listMobileMoneyPayments({ page: 1 })
    expect(apiMock.mock.calls[0][1].query).toEqual({ page: 1, size: 20 })
  })

  it('listCashCommissions GETe une page de commissions cash', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await financeService.listCashCommissions({})
    expect(apiMock).toHaveBeenCalledWith('/admin/cash-commissions', { query: { page: 0, size: 20 } })
  })

  it('listCashCommissions transmet la page demandée', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 3, size: 20 })
    await financeService.listCashCommissions({ page: 3 })
    expect(apiMock.mock.calls[0][1].query).toEqual({ page: 3, size: 20 })
  })

  it('getMobileMoneyCommissions GETe les commissions sans borne : le backend décide de la période', async () => {
    apiMock.mockResolvedValue({ from: '2025-09-09T00:00:00', to: '2026-09-09T00:00:00', byCurrency: [], monthly: [] })
    await financeService.getMobileMoneyCommissions()
    expect(apiMock).toHaveBeenCalledWith('/admin/mobile-money-commissions', { query: { from: undefined, to: undefined } })
  })

  it('getMobileMoneyCommissions transmet les bornes demandées', async () => {
    apiMock.mockResolvedValue({ from: '2026-08-01T00:00:00', to: '2026-08-31T23:59:59', byCurrency: [], monthly: [] })
    await financeService.getMobileMoneyCommissions('2026-08-01T00:00:00', '2026-08-31T23:59:59')
    expect(apiMock.mock.calls[0][1].query).toEqual({ from: '2026-08-01T00:00:00', to: '2026-08-31T23:59:59' })
  })

  it('getMobileMoneyCommissionsForDays borne la période du début du premier jour à la fin du dernier', async () => {
    apiMock.mockResolvedValue({ from: '', to: '', byCurrency: [], monthly: [] })
    await financeService.getMobileMoneyCommissionsForDays('2026-08-01', '2026-08-31')
    expect(apiMock.mock.calls[0][1].query).toEqual({ from: '2026-08-01T00:00:00', to: '2026-08-31T23:59:59' })
  })

  it('getMobileMoneyCommissionsForDays laisse au back une borne absente', async () => {
    apiMock.mockResolvedValue({ from: '', to: '', byCurrency: [], monthly: [] })
    await financeService.getMobileMoneyCommissionsForDays(null, '2026-08-31')
    expect(apiMock.mock.calls[0][1].query).toEqual({ from: undefined, to: '2026-08-31T23:59:59' })
  })

  it('listWalletRefundRequests GETe la file des demandes de remboursement wallet', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await financeService.listWalletRefundRequests(0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/wallet-refund-requests', { query: { page: 0, size: 20 } })
  })

  it('listWalletRefundRequests passe les statuts filtrés en CSV', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await financeService.listWalletRefundRequests(1, 20, ['REFUNDED', 'RESOLVED'])
    expect(apiMock).toHaveBeenCalledWith('/admin/wallet-refund-requests', { query: { page: 1, size: 20, status: 'REFUNDED,RESOLVED' } })
    await financeService.listWalletRefundRequests(0, 20, [])
    expect(apiMock).toHaveBeenLastCalledWith('/admin/wallet-refund-requests', { query: { page: 0, size: 20 } })
  })

  it('resolveWalletRefundRequest POSTe la résolution de la demande', async () => {
    apiMock.mockResolvedValue({ id: 'r1', status: 'RESOLVED' })
    const res = await financeService.resolveWalletRefundRequest('r1')
    expect(apiMock).toHaveBeenCalledWith('/admin/wallet-refund-requests/r1/resolve', { method: 'POST' })
    expect(res.status).toBe('RESOLVED')
  })

  it('resolveWalletRefundRequest envoie le montant versé et la note quand ils sont fournis', async () => {
    apiMock.mockResolvedValue({ id: 'r1', status: 'RESOLVED', paidAmount: 487 })
    await financeService.resolveWalletRefundRequest('r1', { paidAmount: 487, note: 'Wave' })
    expect(apiMock).toHaveBeenCalledWith('/admin/wallet-refund-requests/r1/resolve',
      { method: 'POST', body: { paidAmount: 487, note: 'Wave' } })
  })

  it('getWalletRefundRetryPreview GETe l’aperçu de la relance', async () => {
    apiMock.mockResolvedValue({ amountDue: 477 })
    await financeService.getWalletRefundRetryPreview('r1')
    expect(apiMock).toHaveBeenCalledWith('/admin/wallet-refund-requests/r1/retry-preview')
  })

  it('retryWalletRefundRequest POSTe le montant dû confirmé', async () => {
    apiMock.mockResolvedValue({ amount: 477 })
    await financeService.retryWalletRefundRequest('r1', { amount: 477 })
    expect(apiMock).toHaveBeenCalledWith('/admin/wallet-refund-requests/r1/retry', { method: 'POST', body: { amount: 477 } })
  })

  it('listWallets avec paramètres : filtres envoyés, défauts omis', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await financeService.listWallets({ q: ' awa ', currency: 'XOF', balanceSign: 'NEGATIVE', partyId: 'u1', page: 1, size: 10 })
    expect(apiMock).toHaveBeenCalledWith('/admin/wallets', { query: { q: 'awa', currency: 'XOF', balanceSign: 'NEGATIVE', partyId: 'u1', page: 1, size: 10 } })
    apiMock.mockClear()
    await financeService.listWallets({ q: '', currency: '', balanceSign: '', partyId: '' })
    expect(apiMock).toHaveBeenCalledWith('/admin/wallets', { query: { page: 0, size: 20 } })
  })

  it('listMobileMoneyPayments avec paramètres : vue ALL omise', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await financeService.listMobileMoneyPayments({ view: 'FAILED', kind: 'PAYOUT', provider: 'WAVE_SEN', q: 'abc', page: 0, size: 20 })
    expect(apiMock).toHaveBeenCalledWith('/admin/mobile-money-payments', { query: { view: 'FAILED', kind: 'PAYOUT', provider: 'WAVE_SEN', q: 'abc', page: 0, size: 20 } })
    apiMock.mockClear()
    await financeService.listMobileMoneyPayments({ view: 'ALL' })
    expect(apiMock).toHaveBeenCalledWith('/admin/mobile-money-payments', { query: { page: 0, size: 20 } })
  })

  it('mobileMoneyCounts n\'envoie ni vue ni pagination', async () => {
    apiMock.mockResolvedValue({ failed: 1, open: 0, done: 2, all: 3, attention: 1 })
    const r = await financeService.mobileMoneyCounts({ view: 'FAILED', kind: 'DEPOSIT', provider: '', q: ' x ', page: 3 })
    expect(apiMock).toHaveBeenCalledWith('/admin/mobile-money-payments/counts', { query: { kind: 'DEPOSIT', q: 'x' } })
    expect(r.attention).toBe(1)
  })

  it('listCashCommissions avec paramètres : vue ALL omise', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await financeService.listCashCommissions({ view: 'ATTENTION', status: 'FAILED', q: 'T1', partyId: 'u1', page: 0, size: 20 })
    expect(apiMock).toHaveBeenCalledWith('/admin/cash-commissions', { query: { view: 'ATTENTION', status: 'FAILED', q: 'T1', partyId: 'u1', page: 0, size: 20 } })
    apiMock.mockClear()
    await financeService.listCashCommissions({ view: 'ALL', status: '' })
    expect(apiMock).toHaveBeenCalledWith('/admin/cash-commissions', { query: { page: 0, size: 20 } })
  })

  it('cashCommissionCounts suit q et partyId seulement', async () => {
    apiMock.mockResolvedValue({ attention: 2, all: 5 })
    await financeService.cashCommissionCounts({ q: ' a ', partyId: 'u1' })
    expect(apiMock).toHaveBeenCalledWith('/admin/cash-commissions/counts', { query: { q: 'a', partyId: 'u1' } })
    apiMock.mockClear()
    await financeService.cashCommissionCounts()
    expect(apiMock).toHaveBeenCalledWith('/admin/cash-commissions/counts', { query: {} })
  })
})
