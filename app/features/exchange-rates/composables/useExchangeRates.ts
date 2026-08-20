import { ref } from 'vue'
import { exchangeRatesService } from '@/features/exchange-rates/services/exchangeRatesService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { ExchangeRate } from '@/features/exchange-rates/types/index'

/**
 * État + actions des taux de change : chargement de la liste, mise à jour avec
 * substitution en place de la devise modifiée — jamais de rechargement complet de la
 * liste. Même patron que `usePlatformSettings`.
 */
export function useExchangeRates() {
  const rates = ref<ExchangeRate[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      rates.value = await exchangeRatesService.list()
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les taux de change')
    } finally {
      isLoading.value = false
    }
  }

  function replace(updated: ExchangeRate) {
    const idx = rates.value.findIndex((r) => r.currency === updated.currency)
    if (idx !== -1) rates.value[idx] = updated
  }

  async function update(currency: string, unitsPerEur: number) {
    error.value = null
    busy.value = true
    try {
      replace(await exchangeRatesService.update(currency, unitsPerEur))
    } catch (e) {
      error.value = extractProblemMessage(e, 'Mise à jour impossible')
    } finally {
      busy.value = false
    }
  }

  return { rates, isLoading, error, busy, load, update }
}
