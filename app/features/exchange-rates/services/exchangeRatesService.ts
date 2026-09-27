import { useApi } from '@/composables/useApi'
import type { ExchangeRate } from '@/features/exchange-rates/types/index'

export const exchangeRatesService = {
  list(): Promise<ExchangeRate[]> {
    return useApi()<ExchangeRate[]>('/admin/exchange-rates')
  },
  /** Synchronisation BCE immédiate (même chemin que le cron quotidien). */
  sync(): Promise<{ updated: number }> {
    return useApi()<{ updated: number }>('/admin/exchange-rates/sync', { method: 'POST' })
  },
  update(currency: string, unitsPerEur: number): Promise<ExchangeRate> {
    return useApi()<ExchangeRate>(`/admin/exchange-rates/${currency}`, {
      method: 'PUT',
      body: { unitsPerEur },
    })
  },
}
