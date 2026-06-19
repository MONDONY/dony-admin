import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { paymentsService } from '@/features/payments/services/paymentsService'

describe('paymentsService', () => {
  beforeEach(() => apiMock.mockReset())
  it('list omits TOUS status/method', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await paymentsService.list({ status: 'TOUS', method: 'TOUS' }, 0, 20)
    const q = apiMock.mock.calls[0][1].query
    expect(q.status).toBeUndefined(); expect(q.method).toBeUndefined()
  })
  it('list passes status + method', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await paymentsService.list({ status: 'ESCROW', method: 'STRIPE' }, 1, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ status: 'ESCROW', method: 'STRIPE', page: 1, size: 20 })
  })
  it('forceRelease POSTs', async () => {
    apiMock.mockResolvedValue({ id: 'p1', status: 'RELEASED' })
    await paymentsService.forceRelease('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/payments/p1/force-release', { method: 'POST' })
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
})
