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

  async function load(year: number) {
    isLoading.value = true
    error.value = null
    try {
      overview.value = (await dac7Service.overview(year)) ?? {}
      unavailable.value = false
    } catch (e) {
      if (isEndpointMissing(e)) {
        unavailable.value = true
        overview.value = null
      } else {
        error.value = extractProblemMessage(e, 'Impossible de charger la synthèse DAC7')
      }
    } finally {
      isLoading.value = false
    }
  }

  return { overview, isLoading, error, unavailable, load }
}
