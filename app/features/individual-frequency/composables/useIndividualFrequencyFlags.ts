import { ref } from 'vue'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { individualFrequencyService } from '@/features/individual-frequency/services/individualFrequencyService'
import type { IndividualFrequencyFlagRow } from '@/features/individual-frequency/types/index'

/**
 * File des particuliers à confirmer. `unavailable` : ancien back sans l'endpoint (règle des PR
 * jumelles), liste vide et aucune erreur affichée.
 */
export function useIndividualFrequencyFlags() {
  const items = ref<IndividualFrequencyFlagRow[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      items.value = await individualFrequencyService.list()
      unavailable.value = false
    } catch (e) {
      if (isEndpointMissing(e)) {
        unavailable.value = true
        items.value = []
      } else {
        error.value = extractProblemMessage(e, 'Impossible de charger les particuliers à confirmer')
      }
    } finally {
      isLoading.value = false
    }
  }

  return { items, isLoading, error, unavailable, load }
}
