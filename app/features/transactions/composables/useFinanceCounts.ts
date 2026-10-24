import { ref } from 'vue'
import { transactionsService } from '@/features/transactions/services/transactionsService'
import type { FinanceCounts } from '@/features/transactions/types'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

/**
 * Pastilles des sections. Endpoint absent (ancien back) = indisponible, `counts = null` : la page
 * retombe sur les sept onglets plats. Toute autre erreur garde les derniers nombres, sans lever,
 * et la signale dans `error`. Seule la réponse du dernier appel compte (rechargements qui se chevauchent).
 */
export function useFinanceCounts() {
  const counts = ref<FinanceCounts | null>(null)
  const unavailable = ref(false)
  const error = ref<string | null>(null)
  let seq = 0

  async function reload(): Promise<void> {
    const my = ++seq
    try {
      const res = await transactionsService.counts()
      if (my !== seq) return
      counts.value = res
      unavailable.value = false
      error.value = null
    } catch (e) {
      if (my !== seq) return
      if (isEndpointMissing(e)) { unavailable.value = true; counts.value = null; error.value = null }
      else error.value = extractProblemMessage(e, 'Impossible de charger les nombres des sections')
    }
  }

  return { counts, unavailable, error, reload }
}
