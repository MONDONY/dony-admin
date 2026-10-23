import { ref, toValue, type MaybeRefOrGetter } from 'vue'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminBidPhoto } from '@/features/bids/types/index'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

/**
 * Photos d'un colis, par étape. Chargées une fois par colis (`reload` pour forcer, par exemple
 * quand une URL présignée a expiré). Endpoint absent (ancien back) : `unavailable`, la galerie
 * se rabat alors sur `bid.photoUrls` et les photos de la chronologie.
 */
export function useBidPhotos(bidId: MaybeRefOrGetter<string>) {
  const photos = ref<AdminBidPhoto[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)
  let seq = 0
  let loadedFor: string | null = null
  let pending: Promise<void> | null = null

  async function fetchPhotos(id: string): Promise<void> {
    const my = ++seq
    loadedFor = id
    isLoading.value = true
    error.value = null
    try {
      const res = await bidsAdminService.photos(id)
      if (my !== seq) return
      photos.value = res.photos
      unavailable.value = false
    } catch (e) {
      if (my !== seq) return
      if (isEndpointMissing(e)) { unavailable.value = true; photos.value = [] }
      else { error.value = extractProblemMessage(e, 'Impossible de charger les photos'); loadedFor = null }
    } finally {
      if (my === seq) { isLoading.value = false; pending = null }
    }
  }

  function start(id: string): Promise<void> {
    pending = fetchPhotos(id)
    return pending
  }

  /** Charge les photos du colis, sauf si c'est déjà fait (ou en cours) pour ce colis. */
  function load(): Promise<void> {
    const id = toValue(bidId)
    if (loadedFor === id) return pending ?? Promise.resolve()
    if (loadedFor !== null) { photos.value = []; unavailable.value = false }
    return start(id)
  }

  /** Relit les photos (nouvelles URL présignées). */
  function reload(): Promise<void> {
    return start(toValue(bidId))
  }

  return { photos, isLoading, error, unavailable, load, reload }
}
