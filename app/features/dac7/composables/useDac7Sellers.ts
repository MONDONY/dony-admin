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
  // Jeton d'appel : la réponse du dernier `load` gagne, une réponse en retard est ignorée.
  let current = 0
  let loadedKey: string | null = null

  async function load(year: number, filter: Dac7Filter) {
    const mine = ++current
    const key = `${year}|${filter}`
    // Autre année ou autre filtre : l'ancienne liste disparaît, l'état de chargement prend sa place.
    if (loadedKey !== key) items.value = []
    loadedKey = key
    isLoading.value = true
    error.value = null
    try {
      const rows = await dac7Service.sellers(year, filter)
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
        error.value = extractProblemMessage(e, 'Impossible de charger les voyageurs')
      }
    } finally {
      if (mine === current) isLoading.value = false
    }
  }

  return { items, isLoading, error, unavailable, load }
}
