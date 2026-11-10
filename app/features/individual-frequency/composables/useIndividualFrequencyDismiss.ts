import { ref } from 'vue'
import { extractProblemMessage } from '@/lib/problemDetail'
import { individualFrequencyService } from '@/features/individual-frequency/services/individualFrequencyService'

interface Options {
  /** Alerte inconnue (404) : l'écran est en retard sur la base, l'appelant relit. */
  onStale?: () => void
}

type HttpErrorLike = { statusCode?: number; status?: number; response?: { status?: number } } | undefined

/**
 * Écarte une alerte. Rend true au succès. Le serveur répond 204 même pour une alerte déjà
 * résolue ; un 404 (alerte inconnue, ou ancien back sans l'endpoint) veut dire que l'écran est
 * en retard : l'appelant relit, sans message d'erreur. `unavailable` : 405 seulement.
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
      const err = e as HttpErrorLike
      const status = err?.statusCode ?? err?.status ?? err?.response?.status
      if (status === 404) options.onStale?.()
      else if (status === 405) unavailable.value = true
      else error.value = extractProblemMessage(e, 'L’alerte n’a pas pu être écartée')
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, error, unavailable, clearError, run }
}
