import { ref } from 'vue'
import { reportsService } from '@/features/signalements/services/reportsService'
import type { ReportContext } from '@/features/signalements/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'

/**
 * Une vraie réponse porte toujours `messagesRestricted` (booléen, jamais nul donc jamais omis par
 * le back). Toute autre forme (proxy, ancien back qui répondrait autre chose) n'est pas un contexte.
 */
function isReportContext(value: unknown): value is ReportContext {
  return typeof value === 'object' && value !== null
    && typeof (value as { messagesRestricted?: unknown }).messagesRestricted === 'boolean'
}

/**
 * Contexte du dossier ouvert : une lecture par dossier, jamais bloquante. Le dossier s'affiche
 * sans lui (ancien back sans l'endpoint, droit manquant, panne) : seul un échec inattendu laisse
 * une phrase. J / K enchaînés ne mélangent pas les dossiers : une réponse n'est gardée que si son
 * dossier est encore celui qui est ouvert.
 */
export function useReportContext() {
  const context = ref<ReportContext | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** L'endpoint n'existe pas encore côté serveur (PR jumelle non déployée) : rien à montrer ni à dire. */
  const unavailable = ref(false)
  let current = 0

  function clear() {
    current += 1
    context.value = null
    error.value = null
    isLoading.value = false
  }

  async function load(id: string | null) {
    if (!id) {
      clear()
      return
    }
    const mine = ++current
    context.value = null
    error.value = null
    isLoading.value = true
    try {
      const result = await reportsService.getContext(id)
      if (mine !== current) return
      if (isReportContext(result)) {
        context.value = result
        unavailable.value = false
      } else {
        unavailable.value = true
      }
    } catch (e) {
      if (mine !== current) return
      if (isEndpointMissing(e)) unavailable.value = true
      else error.value = extractProblemMessage(e, 'Contexte indisponible')
    } finally {
      if (mine === current) isLoading.value = false
    }
  }

  return { context, isLoading, error, unavailable, load, clear }
}
