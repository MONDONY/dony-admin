import { ref } from 'vue'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminBidDetail, AdminBidTimeline } from '@/features/bids/types/index'

export function useBidTimeline() {
  const bid = ref<AdminBidDetail | null>(null)
  const timeline = ref<AdminBidTimeline | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function open(id: string) {
    isLoading.value = true; error.value = null
    try {
      const [b, t] = await Promise.all([bidsAdminService.getBid(id), bidsAdminService.getTimeline(id)])
      bid.value = b; timeline.value = t
    } catch (e) { error.value = (e as Error).message } finally { isLoading.value = false }
  }
  function close() { bid.value = null; timeline.value = null }

  return { bid, timeline, isLoading, error, open, close }
}
