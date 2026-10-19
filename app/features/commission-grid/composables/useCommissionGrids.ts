import { ref } from 'vue'
import { commissionGridService } from '@/features/commission-grid/services/commissionGridService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import type { CommissionGrid } from '@/features/commission-grid/types/index'

export const HISTORY_PAGE_SIZE = 20

/**
 * État de l'onglet Tarification : grille en vigueur, grille programmée, historique paginé, et
 * annulation d'une programmation. `unavailable` : back sans l'endpoint (règle des PR jumelles),
 * mention discrète au lieu d'une erreur.
 */
export function useCommissionGrids() {
  const current = ref<CommissionGrid | null>(null)
  const scheduled = ref<CommissionGrid | null>(null)
  const history = ref<CommissionGrid[]>([])
  const currentPage = ref(0)
  const totalPages = ref(0)
  const totalElements = ref(0)
  const isLoading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)

  const cancelling = ref(false)
  const message = ref<string | null>(null)

  /** La page courante ne change qu'une fois la nouvelle page reçue : un échec garde l'ancienne. */
  async function load(page = currentPage.value) {
    isLoading.value = true
    error.value = null
    try {
      const res = await commissionGridService.list(page, HISTORY_PAGE_SIZE)
      current.value = res.current ?? null
      scheduled.value = res.scheduled ?? null
      history.value = res.history?.content ?? []
      totalPages.value = res.history?.totalPages ?? 0
      totalElements.value = res.history?.totalElements ?? history.value.length
      currentPage.value = res.history?.page ?? page
      unavailable.value = false
      loaded.value = true
    } catch (e) {
      if (isEndpointMissing(e)) unavailable.value = true
      else error.value = extractProblemMessage(e, 'Impossible de charger les grilles de commission')
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Annule la grille programmée. La liste est relue dans tous les cas : un 409 (la grille vient
   * d'entrer en vigueur) veut dire que l'écran affiche un état périmé.
   */
  async function cancel(id: string): Promise<boolean> {
    cancelling.value = true
    error.value = null
    message.value = null
    try {
      await commissionGridService.cancel(id)
      message.value = 'La grille programmée est annulée.'
      await load()
      return true
    } catch (e) {
      const msg = extractProblemMessage(e, 'Annulation impossible')
      await load()
      error.value = msg
      return false
    } finally {
      cancelling.value = false
    }
  }

  /** Après une programmation réussie : message de confirmation et relecture. */
  async function onScheduled(grid: CommissionGrid) {
    await load(0)
    message.value = current.value?.id === grid.id
      ? 'La nouvelle grille est en vigueur.'
      : 'La nouvelle grille est programmée.'
  }

  return {
    current, scheduled, history, currentPage, totalPages, totalElements,
    isLoading, loaded, error, unavailable, cancelling, message,
    load, goToPage: load, cancel, onScheduled,
  }
}
