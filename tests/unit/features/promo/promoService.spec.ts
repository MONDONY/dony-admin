import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { promoService } from '@/features/promo/services/promoService'

const INPUT = {
  code: 'WELCOME10', rate: 0.1, target: 'ANY' as const,
  validFrom: null, validTo: '2026-12-31T23:59:59',
  maxRedemptions: 100, perUserLimit: 1,
}

describe('promoService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list GETs the full array (no pagination params)', async () => {
    apiMock.mockResolvedValue([])
    await promoService.list()
    expect(apiMock).toHaveBeenCalledWith('/admin/promo-codes')
  })

  it('create POSTs the input', async () => {
    apiMock.mockResolvedValue({ id: 'p1', ...INPUT })
    await promoService.create(INPUT)
    expect(apiMock).toHaveBeenCalledWith('/admin/promo-codes', { method: 'POST', body: INPUT })
  })

  it('update PUTs the input', async () => {
    apiMock.mockResolvedValue({ id: 'p1', ...INPUT })
    await promoService.update('p1', INPUT)
    expect(apiMock).toHaveBeenCalledWith('/admin/promo-codes/p1', { method: 'PUT', body: INPUT })
  })

  it('setStatus PUTs on /status', async () => {
    apiMock.mockResolvedValue({ id: 'p1', status: 'DISABLED' })
    await promoService.setStatus('p1', 'DISABLED')
    expect(apiMock).toHaveBeenCalledWith('/admin/promo-codes/p1/status', { method: 'PUT', body: { status: 'DISABLED' } })
  })

  it('remove DELETEs', async () => {
    apiMock.mockResolvedValue(undefined)
    await promoService.remove('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/promo-codes/p1', { method: 'DELETE' })
  })
})
