import { ref } from 'vue'
import type { Ref } from 'vue'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'

/**
 * Liste de l'année lue en une fois (remboursements, anomalies). `unavailable` : ancien back sans
 * l'endpoint, liste vide et aucune erreur affichée.
 */
// eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
export function useDac7List<T>(fetcher: (year: number) => Promise<T[]>, errorText: string) {
  const items: Ref<T[]> = ref([]) as Ref<T[]>
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)

  async function load(year: number) {
    isLoading.value = true
    error.value = null
    try {
      items.value = await fetcher(year)
      unavailable.value = false
    } catch (e) {
      if (isEndpointMissing(e)) {
        unavailable.value = true
        items.value = []
      } else {
        error.value = extractProblemMessage(e, errorText)
      }
    } finally {
      isLoading.value = false
    }
  }

  return { items, isLoading, error, unavailable, load }
}
