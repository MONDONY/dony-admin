import { ref } from 'vue'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminBidCounts, BidsFilterState } from '@/features/bids/types/index'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

/** Nombres par vue ; endpoint absent (back pas encore déployé) = fonctionnalité indisponible, pas une erreur. */
export function useBidCounts(filters: BidsFilterState) {
  const counts = ref<AdminBidCounts | null>(null)
  const unavailable = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let seq = 0

  async function reload(): Promise<void> {
    const my = ++seq
    isLoading.value = true
    error.value = null
    try {
      const res = await bidsAdminService.counts(filters)
      if (my !== seq) return
      counts.value = res
      unavailable.value = false
    } catch (e) {
      if (my !== seq) return
      if (isEndpointMissing(e)) { unavailable.value = true; counts.value = null }
      else error.value = extractProblemMessage(e, 'Impossible de charger les nombres')
    } finally {
      if (my === seq) isLoading.value = false
    }
  }

  return { counts, unavailable, isLoading, error, reload }
}
