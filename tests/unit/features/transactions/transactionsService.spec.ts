import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { isEndpointMissing } from '@/lib/endpointMissing'
import { transactionsService } from '@/features/transactions/services/transactionsService'

describe('transactionsService', () => {
  // Accolades : un beforeEach qui RENVOIE le mock serait appelé par vitest comme nettoyage.
  beforeEach(() => { apiMock.mockReset() })

  it('counts GETe /admin/finance/counts et rend les nombres tels quels', async () => {
    const body = {
      payments: 4, mobileMoney: 1, soldes: 3, chargebacks: 2,
      details: { paymentsAttention: 4, mobileMoneyAttention: 1, walletRefundsPending: 2, cashCommissionsAttention: 1, chargebacksOpen: 2 },
    }
    apiMock.mockResolvedValue(body)
    const r = await transactionsService.counts()
    expect(apiMock).toHaveBeenCalledWith('/admin/finance/counts')
    expect(r).toEqual(body)
  })

  it('counts laisse remonter l\'erreur d\'un backend sans la route (le repli est à l\'appelant)', async () => {
    apiMock.mockImplementation(() => Promise.reject({ statusCode: 404 }))
    let err: unknown = null
    try { await transactionsService.counts() } catch (e) { err = e }
    expect(isEndpointMissing(err)).toBe(true)
  })
})
