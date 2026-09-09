import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { financeService } from '@/features/finance/services/financeService'

describe('financeService', () => {
  beforeEach(() => apiMock.mockReset())

  it('listWallets GETe une page de portefeuilles', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await financeService.listWallets(0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/wallets', { query: { page: 0, size: 20 } })
  })

  it('listWallets transmet la page et la taille demandées', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 2, size: 10 })
    await financeService.listWallets(2, 10)
    expect(apiMock.mock.calls[0][1].query).toEqual({ page: 2, size: 10 })
  })

  it('listMobileMoneyPayments GETe une page de paiements mobile money', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await financeService.listMobileMoneyPayments(0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/mobile-money-payments', { query: { page: 0, size: 20 } })
  })

  it('listMobileMoneyPayments transmet la page demandée', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 1, size: 20 })
    await financeService.listMobileMoneyPayments(1, 20)
    expect(apiMock.mock.calls[0][1].query).toEqual({ page: 1, size: 20 })
  })

  it('listCashCommissions GETe une page de commissions cash', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await financeService.listCashCommissions(0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/cash-commissions', { query: { page: 0, size: 20 } })
  })

  it('listCashCommissions transmet la page demandée', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 3, size: 20 })
    await financeService.listCashCommissions(3, 20)
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
})
