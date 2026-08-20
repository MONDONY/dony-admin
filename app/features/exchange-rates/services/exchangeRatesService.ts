import { useApi } from '@/composables/useApi'
import type { ExchangeRate } from '@/features/exchange-rates/types/index'

export const exchangeRatesService = {
  list(): Promise<ExchangeRate[]> {
    return useApi()<ExchangeRate[]>('/admin/exchange-rates')
  },
  update(currency: string, unitsPerEur: number): Promise<ExchangeRate> {
    return useApi()<ExchangeRate>(`/admin/exchange-rates/${currency}`, {
      method: 'PUT',
      body: { unitsPerEur },
    })
  },
}
