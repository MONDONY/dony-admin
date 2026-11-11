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
  // Jeton d'appel : la réponse du dernier `load` gagne, une réponse en retard est ignorée.
  let current = 0
  let loadedYear: number | null = null

  async function load(year: number) {
    const mine = ++current
    // Autre année : l'ancienne liste disparaît, l'état de chargement prend sa place.
    if (loadedYear !== year) items.value = []
    loadedYear = year
    isLoading.value = true
    error.value = null
    try {
      const rows = await fetcher(year)
      if (mine !== current) return
      items.value = rows
      unavailable.value = false
    } catch (e) {
      if (mine !== current) return
      items.value = []
      if (isEndpointMissing(e)) {
        unavailable.value = true
      } else {
        unavailable.value = false
        error.value = extractProblemMessage(e, errorText)
      }
    } finally {
      if (mine === current) isLoading.value = false
    }
  }

  return { items, isLoading, error, unavailable, load }
}
