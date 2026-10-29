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
  /**
   * `confirmLargeChange` : un écart de plus de 10 % avec le taux en place est refusé par le back
   * (422 `exchange-rate-large-change`) tant qu'il n'est pas confirmé explicitement.
   */
  update(currency: string, unitsPerEur: number, confirmLargeChange = false): Promise<ExchangeRate> {
    return useApi()<ExchangeRate>(`/admin/exchange-rates/${currency}`, {
      method: 'PUT',
      body: confirmLargeChange ? { unitsPerEur, confirmLargeChange: true } : { unitsPerEur },
    })
  },
}
