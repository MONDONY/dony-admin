import { ratingsService } from '@/features/signalements/services/ratingsService'
import type { RatingContext } from '@/features/signalements/types/index'
import { useContextLoader } from './useContextLoader'

/**
 * Une vraie réponse porte toujours `sameRelationCount` et `openReports` (nombres, jamais nuls donc
 * jamais omis par le back). Toute autre forme n'est pas un contexte d'avis.
 */
function isRatingContext(value: unknown): value is RatingContext {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { sameRelationCount?: unknown; openReports?: unknown }
  return typeof v.sameRelationCount === 'number' && typeof v.openReports === 'number'
}

/** Contexte de l'avis ouvert (lecture, courses, tolérance d'un ancien back : voir `useContextLoader`). */
export function useRatingContext() {
  return useContextLoader<RatingContext>((id) => ratingsService.getContext(id), isRatingContext)
}
