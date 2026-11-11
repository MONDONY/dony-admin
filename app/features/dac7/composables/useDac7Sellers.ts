import { ref } from 'vue'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { dac7Service } from '@/features/dac7/services/dac7Service'
import type { Dac7Filter, Dac7Seller } from '@/features/dac7/types/index'

/**
 * Tableau des voyageurs de l'année. `unavailable` : ancien back sans l'endpoint (règle des PR
 * jumelles), liste vide et aucune erreur affichée.
 */
export function useDac7Sellers() {
  const items = ref<Dac7Seller[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)

  async function load(year: number, filter: Dac7Filter) {
    isLoading.value = true
    error.value = null
    try {
      items.value = await dac7Service.sellers(year, filter)
      unavailable.value = false
    } catch (e) {
      if (isEndpointMissing(e)) {
        unavailable.value = true
        items.value = []
      } else {
        error.value = extractProblemMessage(e, 'Impossible de charger les voyageurs')
      }
    } finally {
      isLoading.value = false
    }
  }

  return { items, isLoading, error, unavailable, load }
}
