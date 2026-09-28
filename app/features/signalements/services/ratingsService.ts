import { useApi } from '@/composables/useApi'
import type { AdminRating, AdminRatingPage, RatingsFilterState } from '@/features/signalements/types/index'

function buildQuery(f: RatingsFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.flaggedOnly) q.flaggedOnly = true
  if (f.deleted) q.deleted = true
  return q
}

export const ratingsService = {
  list(filters: RatingsFilterState, page: number, size: number): Promise<AdminRatingPage> {
    return useApi()<AdminRatingPage>('/admin/ratings', { query: buildQuery(filters, page, size) })
  },
  exclude(id: string, excluded: boolean, reason: string): Promise<AdminRating> {
    return useApi()<AdminRating>(`/admin/ratings/${id}/exclude`, { method: 'POST', body: { excluded, reason } })
  },
  /**
   * Le motif part en paramètre de requête (un DELETE ne porte pas de corps fiable). Omis
   * s'il est vide : un back qui ne le lit pas encore l'ignore sans erreur.
   */
  remove(id: string, reason?: string): Promise<void> {
    const trimmed = reason?.trim()
    if (!trimmed) return useApi()<void>(`/admin/ratings/${id}`, { method: 'DELETE' })
    return useApi()<void>(`/admin/ratings/${id}`, { method: 'DELETE', query: { reason: trimmed } })
  },
  /** Restaure un avis supprimé (RATING_DELETE) : le back recalcule la note du voyageur. */
  restore(id: string, reason: string): Promise<AdminRating> {
    return useApi()<AdminRating>(`/admin/ratings/${id}/restore`, { method: 'POST', body: { reason } })
  },
}
