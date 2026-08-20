import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { exchangeRatesService } from '@/features/exchange-rates/services/exchangeRatesService'

describe('exchangeRatesService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list() interroge /admin/exchange-rates', async () => {
    apiMock.mockResolvedValue([])
    await exchangeRatesService.list()
    expect(apiMock).toHaveBeenCalledWith('/admin/exchange-rates')
  })

  it('list() renvoie les taux tels que renvoyés par le back', async () => {
    const rates = [
      { currency: 'EUR', unitsPerEur: 1, updatedAt: null, updatedBy: null },
      { currency: 'USD', unitsPerEur: 1.08, updatedAt: null, updatedBy: null },
    ]
    apiMock.mockResolvedValue(rates)
    const res = await exchangeRatesService.list()
    expect(res).toEqual(rates)
  })

  it('update() PUTe le nouveau taux sur la devise', async () => {
    apiMock.mockResolvedValue({
      currency: 'USD', unitsPerEur: 1.1,
      updatedAt: '2026-08-20T10:00:00Z', updatedBy: 'admin-uuid',
    })
    const res = await exchangeRatesService.update('USD', 1.1)
    expect(apiMock).toHaveBeenCalledWith('/admin/exchange-rates/USD', {
      method: 'PUT',
      body: { unitsPerEur: 1.1 },
    })
    expect(res.unitsPerEur).toBe(1.1)
    expect(res.updatedBy).toBe('admin-uuid')
  })
})
