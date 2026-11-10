import { ref } from 'vue'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { individualFrequencyService } from '@/features/individual-frequency/services/individualFrequencyService'
import { INDIVIDUAL_FREQUENCY_STALE_MESSAGE } from '@/features/individual-frequency/types/index'

interface Options {
  /** Alerte inconnue ou déjà close : l'écran est en retard sur la base, l'appelant relit. */
  onStale?: () => void
}

type HttpErrorLike = { statusCode?: number; status?: number; response?: { status?: number } } | undefined

/**
 * Écarte une alerte. Rend true au succès. `unavailable` : ancien back sans l'endpoint, le bouton
 * disparaît sans message d'erreur.
 */
export function useIndividualFrequencyDismiss(options: Options = {}) {
  const busy = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)

  function clearError() { error.value = null }

  async function run(flagId: string): Promise<boolean> {
    clearError()
    busy.value = true
    try {
      await individualFrequencyService.dismiss(flagId)
      return true
    } catch (e) {
      if (isEndpointMissing(e)) {
        unavailable.value = true
        return false
      }
      const err = e as HttpErrorLike
      if ((err?.statusCode ?? err?.status ?? err?.response?.status) === 404) {
        error.value = INDIVIDUAL_FREQUENCY_STALE_MESSAGE
        options.onStale?.()
      } else {
        error.value = extractProblemMessage(e, 'L’alerte n’a pas pu être écartée')
      }
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, error, unavailable, clearError, run }
}
