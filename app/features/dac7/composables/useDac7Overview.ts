import { ref } from 'vue'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { dac7Service } from '@/features/dac7/services/dac7Service'
import type { Dac7Overview } from '@/features/dac7/types/index'

/**
 * Synthèse de l'année. `unavailable` : ancien back sans l'endpoint (règle des PR jumelles) ; la
 * page entière se replie alors sur « Non disponible sur cette version du serveur », sans erreur.
 */
export function useDac7Overview() {
  const overview = ref<Dac7Overview | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)
  // Jeton d'appel : seule la réponse du dernier `load` est prise en compte (une réponse lente
  // d'une année abandonnée ne doit jamais s'afficher sous une autre année).
  let current = 0
  let loadedYear: number | null = null

  async function load(year: number) {
    const mine = ++current
    // Autre année : les anciens chiffres disparaissent, l'état de chargement prend leur place.
    if (loadedYear !== year) overview.value = null
    loadedYear = year
    isLoading.value = true
    error.value = null
    try {
      const body = (await dac7Service.overview(year)) ?? {}
      if (mine !== current) return
      overview.value = body
      unavailable.value = false
    } catch (e) {
      if (mine !== current) return
      overview.value = null
      if (isEndpointMissing(e)) {
        unavailable.value = true
      } else {
        unavailable.value = false
        error.value = extractProblemMessage(e, 'Impossible de charger la synthèse DAC7')
      }
    } finally {
      if (mine === current) isLoading.value = false
    }
  }

  return { overview, isLoading, error, unavailable, load }
}
