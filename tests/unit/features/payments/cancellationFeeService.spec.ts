import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { paymentsService } from '@/features/payments/services/paymentsService'
import { feeOf } from './cancellationFee.fixtures'

describe('paymentsService : frais d’annulation', () => {
  beforeEach(() => { apiMock.mockReset() })

  it('getCancellationFee lit la retenue du colis', async () => {
    apiMock.mockResolvedValue(feeOf())
    expect(await paymentsService.getCancellationFee('bid-1')).toEqual(feeOf())
    expect(apiMock).toHaveBeenCalledWith('/admin/cancellation-fees/bids/bid-1')
  })
  it.each([
    ['statusCode', { statusCode: 404, data: { code: 'cancellation-fee-not-found' } }],
    ['status', { status: 404 }],
    ['response.status', { response: { status: 404 } }],
    ['endpoint absent (sans code)', { statusCode: 404, data: {} }],
  ])('404 (%s) : null, pas une erreur', async (_n, err) => {
    apiMock.mockRejectedValue(err)
    expect(await paymentsService.getCancellationFee('bid-1')).toBeNull()
  })
  it('une autre erreur remonte', async () => {
    apiMock.mockRejectedValue({ statusCode: 500 })
    await expect(paymentsService.getCancellationFee('bid-1')).rejects.toEqual({ statusCode: 500 })
  })
  it('waiveCancellationFee POST le motif sur le colis', async () => {
    apiMock.mockResolvedValue(feeOf({ status: 'NOT_APPLICABLE' }))
    await paymentsService.waiveCancellationFee('bid-1', 'motif de test')
    expect(apiMock).toHaveBeenCalledWith('/admin/cancellation-fees/bids/bid-1/waive', { method: 'POST', body: { reason: 'motif de test' } })
  })
  it('retryCancellationFeePayout POST le motif sur la retenue', async () => {
    apiMock.mockResolvedValue(feeOf({ status: 'PAID_OUT' }))
    await paymentsService.retryCancellationFeePayout('fee-1', 'motif de test')
    expect(apiMock).toHaveBeenCalledWith('/admin/cancellation-fees/fee-1/retry-payout', { method: 'POST', body: { reason: 'motif de test' } })
  })
})
