import { ref } from 'vue'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { GP_PRO_CODE_MESSAGES, GP_PRO_STALE_CODES } from '@/features/gp-pro/types/index'

interface Options {
  /** Conflit « écran en retard sur la base » : l'appelant relit. */
  onStale?: () => void
}

/**
 * Exécute un geste GP Pro (accepter, refuser, accorder, retirer, écarter une alerte).
 * Rend true au succès. `unavailable` : ancien back sans l'endpoint, les boutons disparaissent.
 */
export function useGpProAction(options: Options = {}) {
  const busy = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)

  function clearError() { error.value = null }

  async function run(call: () => Promise<unknown>, fallback = 'La décision n’a pas pu être enregistrée'): Promise<boolean> {
    clearError()
    busy.value = true
    try {
      await call()
      return true
    } catch (e) {
      if (isEndpointMissing(e)) {
        unavailable.value = true
        return false
      }
      const code = problemCode(e)
      const hasDetail = typeof (e as { data?: { detail?: unknown } })?.data?.detail === 'string'
      error.value = !hasDetail && code && GP_PRO_CODE_MESSAGES[code]
        ? GP_PRO_CODE_MESSAGES[code]
        : extractProblemMessage(e, fallback)
      if (code && GP_PRO_STALE_CODES.has(code)) options.onStale?.()
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, error, unavailable, clearError, run }
}
