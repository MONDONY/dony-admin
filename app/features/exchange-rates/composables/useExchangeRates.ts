import { ref } from 'vue'
import { exchangeRatesService } from '@/features/exchange-rates/services/exchangeRatesService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { problemCode } from '@/lib/endpointMissing'
import type { ExchangeRate } from '@/features/exchange-rates/types/index'

/** Saisie refusée parce qu'elle s'écarte de plus de 10 % du taux en place : à confirmer. */
export interface LargeRateChange {
  currency: string
  unitsPerEur: number
  currentRate: string
  changePercent: string
}

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
  const syncing = ref(false)
  const syncMessage = ref<string | null>(null)
  const largeChange = ref<LargeRateChange | null>(null)

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

  /**
   * Une saisie trop éloignée du taux en place (faute de frappe probable) n'est pas une erreur :
   * elle ouvre une confirmation (`largeChange`), puis repart avec `confirmLarge`.
   */
  async function update(currency: string, unitsPerEur: number, confirmLarge = false) {
    error.value = null
    largeChange.value = null
    busy.value = true
    try {
      replace(await exchangeRatesService.update(currency, unitsPerEur, confirmLarge))
    } catch (e) {
      if (!confirmLarge && problemCode(e) === 'exchange-rate-large-change') {
        const data = (e as { data?: { currentRate?: string; changePercent?: string } }).data
        largeChange.value = {
          currency, unitsPerEur,
          currentRate: data?.currentRate ?? '',
          changePercent: data?.changePercent ?? '',
        }
      } else {
        error.value = extractProblemMessage(e, 'Mise à jour impossible')
      }
    } finally {
      busy.value = false
    }
  }

  /** Confirme la saisie en attente : le back l'applique malgré l'écart. */
  async function confirmLargeChange() {
    const pending = largeChange.value
    largeChange.value = null
    if (pending) await update(pending.currency, pending.unitsPerEur, true)
  }

  function cancelLargeChange() {
    largeChange.value = null
  }

  /**
   * Synchronisation BCE à la demande, avec les garde-fous du cron (parité fixe, variation
   * maximale). La liste est rechargée sans repasser par l'état « Chargement… » : le tableau
   * reste affiché et se met à jour en place.
   */
  async function sync() {
    error.value = null
    syncMessage.value = null
    syncing.value = true
    try {
      const { updated } = await exchangeRatesService.sync()
      syncMessage.value = syncSummary(updated)
      rates.value = await exchangeRatesService.list()
    } catch (e) {
      error.value = extractProblemMessage(e, 'Synchronisation BCE impossible')
    } finally {
      syncing.value = false
    }
  }

  return {
    rates, isLoading, error, busy, syncing, syncMessage, largeChange, load, update, sync,
    confirmLargeChange, cancelLargeChange,
  }
}

function syncSummary(updated: number): string {
  if (updated === 0) return 'Aucune devise modifiée : les taux étaient déjà à jour'
  return updated === 1 ? '1 devise mise à jour par la BCE' : `${updated} devises mises à jour par la BCE`
}
