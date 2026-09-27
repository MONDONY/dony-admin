import { ref } from 'vue'
import { packageRequestsService } from '@/features/package-requests/services/packageRequestsService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import type { AdminPackageRequestDetail } from '@/features/package-requests/types/index'

export const PACKAGE_REQUESTS_UNAVAILABLE = 'Modération des demandes indisponible pour le moment'

/** Conflits qui signifient « l'écran est en retard sur la base » : on relit la fiche. */
const STALE_CODES = new Set(['package-request-already-removed', 'package-request-not-removed'])

/**
 * Fiche d'une demande d'envoi et ses deux actions de modération. Les actions rendent le
 * détail mis à jour (ou null en cas d'échec) pour que la page répercute la ligne de la liste.
 */
export function usePackageRequestDetail() {
  const request = ref<AdminPackageRequestDetail | null>(null)
  const openId = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)
  const actionError = ref<string | null>(null)
  const actionErrorCode = ref<string | null>(null)

  async function fetchDetail(id: string) {
    try {
      const res = await packageRequestsService.get(id)
      // Fiche fermée (ou autre fiche ouverte) pendant la requête : réponse ignorée.
      if (openId.value === id) request.value = res
    } catch (e) {
      if (openId.value !== id) return
      error.value = isEndpointMissing(e) ? PACKAGE_REQUESTS_UNAVAILABLE : extractProblemMessage(e, 'Impossible de charger la demande')
    }
  }

  async function open(id: string) {
    openId.value = id
    request.value = null
    error.value = null
    actionError.value = null
    actionErrorCode.value = null
    isLoading.value = true
    try {
      await fetchDetail(id)
    } finally {
      isLoading.value = false
    }
  }

  function close() {
    openId.value = null
    request.value = null
    error.value = null
    actionError.value = null
    actionErrorCode.value = null
  }

  /** `fn` reçoit l'id de la fiche ouverte (même signature que `restore` du service). */
  async function run(fn: typeof packageRequestsService.restore): Promise<AdminPackageRequestDetail | null> {
    const id = request.value?.id
    if (!id) return null
    actionError.value = null
    actionErrorCode.value = null
    busy.value = true
    try {
      const updated = await fn(id)
      request.value = updated
      return updated
    } catch (e) {
      actionError.value = extractProblemMessage(e, 'Action échouée')
      actionErrorCode.value = problemCode(e)
      if (actionErrorCode.value && STALE_CODES.has(actionErrorCode.value)) await fetchDetail(id)
      return null
    } finally {
      busy.value = false
    }
  }

  const remove = (publicReason: string, internalNote: string) =>
    run((id) => packageRequestsService.remove(id, publicReason, internalNote))
  const restore = () => run((id) => packageRequestsService.restore(id))

  return { request, openId, isLoading, error, busy, actionError, actionErrorCode, open, close, remove, restore }
}
