import { ref } from 'vue'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminBidDetail, AdminBidTimeline } from '@/features/bids/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

/**
 * Fiche colis + chronologie. Les deux se chargent en parallèle mais indépendamment : une
 * chronologie en échec laisse la fiche lisible (avant, l'échec de l'une masquait les deux).
 */
export function useBidTimeline() {
  const bid = ref<AdminBidDetail | null>(null)
  const timeline = ref<AdminBidTimeline | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const timelineLoading = ref(false)
  const timelineError = ref<string | null>(null)
  const openId = ref<string | null>(null)

  async function loadTimeline(id: string) {
    timelineLoading.value = true; timelineError.value = null
    try {
      const t = await bidsAdminService.getTimeline(id)
      if (openId.value === id) timeline.value = t
    } catch (e) {
      if (openId.value === id) timelineError.value = extractProblemMessage(e, 'Impossible de charger la chronologie')
    } finally { timelineLoading.value = false }
  }

  async function loadBid(id: string) {
    isLoading.value = true; error.value = null
    try {
      const b = await bidsAdminService.getBid(id)
      if (openId.value === id) bid.value = b
    } catch (e) {
      if (openId.value === id) error.value = extractProblemMessage(e, 'Impossible de charger le colis')
    } finally { isLoading.value = false }
  }

  async function open(id: string) {
    openId.value = id
    bid.value = null; timeline.value = null
    await Promise.all([loadBid(id), loadTimeline(id)])
  }

  /** Relit la fiche et la chronologie du colis ouvert (après une resynchronisation Stripe). */
  async function reload() {
    const id = openId.value
    if (!id) return
    await Promise.all([loadBid(id), loadTimeline(id)])
  }

  function close() {
    openId.value = null
    bid.value = null; timeline.value = null
    error.value = null; timelineError.value = null
  }

  return { bid, timeline, isLoading, error, timelineLoading, timelineError, openId, open, reload, close }
}
