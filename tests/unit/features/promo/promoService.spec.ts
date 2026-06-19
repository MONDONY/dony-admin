import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { promoService } from '@/features/promo/services/promoService'

const INPUT = { code: 'WELCOME10', type: 'PERCENT', value: 10, maxRedemptions: 100, expiresAt: '2026-12-31', active: true }

describe('promoService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list omits active when null', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await promoService.list({ active: null }, 0, 20)
    const q = apiMock.mock.calls[0][1].query
    expect(q).toMatchObject({ page: 0, size: 20 })
    expect(q.active).toBeUndefined()
  })

  it('list passes active when set', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await promoService.list({ active: true }, 1, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ active: true, page: 1, size: 20 })
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

  it('remove DELETEs', async () => {
    apiMock.mockResolvedValue(undefined)
    await promoService.remove('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/promo-codes/p1', { method: 'DELETE' })
  })
})
