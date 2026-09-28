import { reactive, ref } from 'vue'
import { ratingsService } from '@/features/signalements/services/ratingsService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { reasonViolationMessage } from '@/lib/restoreReason'
import type { AdminRating, RatingsFilterState } from '@/features/signalements/types/index'

export function useRatings() {
  const ratings = ref<AdminRating[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<RatingsFilterState>({ flaggedOnly: false, deleted: false })
  /** Ancien back : `deleted=true` ignoré, avis actifs renvoyés sans `deletedAt` (liste vidée). */
  const deletedFilterUnsupported = ref(false)
  /** POST /admin/ratings/{id}/restore absent (404/405 sans code) : action masquée. */
  const restoreUnavailable = ref(false)
  /** Motif refusé par la validation du back (422 `violations`) : affiché dans le dialogue. */
  const reasonError = ref<string | null>(null)
  /** Avis supplantés (409 `rating-superseded`) : l'auteur a renoté, plus de restauration possible. */
  const supersededIds = ref<string[]>([])

  async function fetchRatings() {
    isLoading.value = true
    error.value = null
    try {
      const page = await ratingsService.list(filters, currentPage.value, pageSize.value)
      deletedFilterUnsupported.value = Boolean(filters.deleted) && page.content.length > 0
        && page.content.every((r) => !r.deletedAt)
      ratings.value = deletedFilterUnsupported.value ? [] : page.content
      totalPages.value = deletedFilterUnsupported.value ? 0 : page.totalPages
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les avis')
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) { currentPage.value = p; await fetchRatings() }
  async function setFlaggedOnly(v: boolean) { filters.flaggedOnly = v; currentPage.value = 0; await fetchRatings() }
  async function setDeletedFilter(v: boolean) { filters.deleted = v; currentPage.value = 0; await fetchRatings() }
  async function exclude(id: string, excluded: boolean, reason: string) {
    await ratingsService.exclude(id, excluded, reason)
    await fetchRatings()
  }
  /** Retourne true si l'avis est supprimé ; sinon `error` porte le motif du refus. */
  async function remove(id: string, reason?: string): Promise<boolean> {
    error.value = null
    try {
      await ratingsService.remove(id, reason)
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de supprimer cet avis')
      return false
    }
    await fetchRatings()
    return true
  }

  /** Rend true si l'avis est restauré ; un 409 relit la liste et garde le detail dans `error`. */
  async function restore(id: string, reason: string): Promise<boolean> {
    error.value = null
    reasonError.value = null
    try {
      await ratingsService.restore(id, reason)
    } catch (e) {
      if (isEndpointMissing(e)) { restoreUnavailable.value = true; return false }
      const invalid = reasonViolationMessage(e)
      if (invalid) { reasonError.value = invalid; return false }
      if (problemCode(e) === 'rating-superseded') {
        if (!supersededIds.value.includes(id)) supersededIds.value = [...supersededIds.value, id]
        error.value = 'L’auteur a noté de nouveau cette livraison depuis : cet avis ne peut plus être restauré.'
        return false
      }
      const message = extractProblemMessage(e, 'Impossible de restaurer cet avis')
      // La relecture remet `error` à zéro : le refus est posé après.
      await fetchRatings()
      error.value = message
      return false
    }
    await fetchRatings()
    return true
  }

  return { deletedFilterUnsupported, restoreUnavailable, reasonError, supersededIds, setDeletedFilter, restore, ratings, isLoading, error, totalPages, currentPage, pageSize, filters, fetchRatings, goToPage, setFlaggedOnly, exclude, remove }
}
