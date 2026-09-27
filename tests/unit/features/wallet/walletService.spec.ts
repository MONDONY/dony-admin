import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { walletService } from '@/features/wallet/services/walletService'

const EMPTY_PAGE = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

describe('walletService', () => {
  beforeEach(() => apiMock.mockReset())

  it('getUserWallet lit les comptes du portefeuille de l’utilisateur', async () => {
    apiMock.mockResolvedValue({ accounts: [] })
    await walletService.getUserWallet('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/wallet')
  })

  it('listTransactions omet les filtres vides et transmet la pagination', async () => {
    apiMock.mockResolvedValue(EMPTY_PAGE)
    await walletService.listTransactions('u1', { currency: null, type: null }, 2, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/wallet/transactions', { query: { page: 2, size: 20 } })
  })

  it('listTransactions transmet la devise et le type filtrés', async () => {
    apiMock.mockResolvedValue(EMPTY_PAGE)
    await walletService.listTransactions('u1', { currency: 'XOF', type: 'ADMIN_CREDIT' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query).toEqual({ page: 0, size: 20, currency: 'XOF', type: 'ADMIN_CREDIT' })
  })

  it('adjust POSTe le corps et porte l’en-tête Idempotency-Key', async () => {
    apiMock.mockResolvedValue({ account: {}, transaction: {} })
    const body = { currency: 'EUR', direction: 'CREDIT' as const, amount: 5, reason: 'geste commercial validé' }
    await walletService.adjust('u1', body, 'key-123')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/wallet/adjustments', {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': 'key-123' },
    })
  })
})
