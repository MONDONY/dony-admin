import { ref } from 'vue'
import { gpProService } from '@/features/gp-pro/services/gpProService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminGpProApplicationDetail } from '@/features/gp-pro/types/index'

/**
 * Fiche d'une demande GP Pro. Les liens des justificatifs expirent après 15 minutes :
 * relire la fiche en fournit de nouveaux.
 */
export function useGpProApplication() {
  const detail = ref<AdminGpProApplicationDetail | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function load(id: string) {
    isLoading.value = true
    error.value = null
    detail.value = null
    try {
      detail.value = await gpProService.getApplication(id)
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger la demande')
    } finally {
      isLoading.value = false
    }
  }

  /** Relit sans vider la fiche affichée (liens expirés, décision prise ailleurs). */
  async function refresh(id: string) {
    error.value = null
    try {
      detail.value = await gpProService.getApplication(id)
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de relire la demande')
    }
  }

  function clear() {
    detail.value = null
    error.value = null
  }

  return { detail, isLoading, error, load, refresh, clear }
}
