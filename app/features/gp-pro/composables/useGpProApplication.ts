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
  /**
   * Dernière lecture lancée : une réponse plus ancienne (clics rapides d'une demande à l'autre) est
   * écartée. Sans cela, la fiche d'une demande pourrait s'afficher, et se décider, sous une autre.
   */
  let reads = 0

  async function load(id: string) {
    const mine = ++reads
    isLoading.value = true
    error.value = null
    detail.value = null
    try {
      const res = await gpProService.getApplication(id)
      if (mine === reads) detail.value = res
    } catch (e) {
      if (mine === reads) error.value = extractProblemMessage(e, 'Impossible de charger la demande')
    } finally {
      if (mine === reads) isLoading.value = false
    }
  }

  /** Relit sans vider la fiche affichée (liens expirés, décision prise ailleurs). */
  async function refresh(id: string) {
    const mine = ++reads
    error.value = null
    try {
      const res = await gpProService.getApplication(id)
      if (mine === reads) detail.value = res
    } catch (e) {
      if (mine === reads) error.value = extractProblemMessage(e, 'Impossible de relire la demande')
    }
  }

  function clear() {
    reads++
    detail.value = null
    error.value = null
    isLoading.value = false
  }

  return { detail, isLoading, error, load, refresh, clear }
}
