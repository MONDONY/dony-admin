import { useApi } from '@/composables/useApi'
import type { AdminRating, AdminRatingPage, RatingsFilterState } from '@/features/signalements/types/index'

function buildQuery(f: RatingsFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.flaggedOnly) q.flaggedOnly = true
  return q
}

export const ratingsService = {
  list(filters: RatingsFilterState, page: number, size: number): Promise<AdminRatingPage> {
    return useApi()<AdminRatingPage>('/admin/ratings', { query: buildQuery(filters, page, size) })
  },
  exclude(id: string, excluded: boolean, reason: string): Promise<AdminRating> {
    return useApi()<AdminRating>(`/admin/ratings/${id}/exclude`, { method: 'POST', body: { excluded, reason } })
  },
  remove(id: string): Promise<void> {
    return useApi()(`/admin/ratings/${id}`, { method: 'DELETE' })
  },
}
