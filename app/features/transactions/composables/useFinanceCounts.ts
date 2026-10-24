import { ref } from 'vue'
import { transactionsService } from '@/features/transactions/services/transactionsService'
import type { FinanceCounts } from '@/features/transactions/types'
import { isEndpointMissing } from '@/lib/endpointMissing'

/**
 * Pastilles des sections. Endpoint absent (ancien back) = indisponible, `counts = null` : la page
 * retombe sur les sept onglets plats. Toute autre erreur garde les derniers nombres, sans lever.
 */
export function useFinanceCounts() {
  const counts = ref<FinanceCounts | null>(null)
  const unavailable = ref(false)

  async function reload(): Promise<void> {
    try {
      counts.value = await transactionsService.counts()
      unavailable.value = false
    } catch (e) {
      if (isEndpointMissing(e)) { unavailable.value = true; counts.value = null }
    }
  }

  return { counts, unavailable, reload }
}
