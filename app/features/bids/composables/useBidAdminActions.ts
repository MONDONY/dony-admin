import { ref } from 'vue'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import { isEndpointMissing } from '@/lib/endpointMissing'
import {
  cancelErrorMessage, cancelSuccessMessage, disputeErrorMessage, disputeSuccessMessage,
} from '@/features/bids/lib/bidActions'
import type { AdminBidCancelReason, AdminDisputeReason, DisputeParty } from '@/features/bids/lib/bidActions'

/**
 * Endpoint absent (back pas encore déployé : 404/405 sans code métier) : retenu pour la
 * session, le bouton disparaît de toutes les fiches au lieu d'échouer à chaque clic.
 */
const cancelUnavailable = ref(false)
const disputeUnavailable = ref(false)

/** Pour les tests : l'indisponibilité est partagée entre instances. */
export function resetBidActionsAvailability() { cancelUnavailable.value = false; disputeUnavailable.value = false }

export function useBidAdminActions() {
  const busy = ref(false)
  const error = ref<string | null>(null)
  const success = ref<string | null>(null)

  /** Vrai si l'action a abouti. Un second appel pendant le premier est ignoré (double clic). */
  async function cancel(bidId: string, reason: AdminBidCancelReason, note: string): Promise<boolean> {
    if (busy.value) return false
    busy.value = true; error.value = null; success.value = null
    try {
      const r = await bidsAdminService.cancelBid(bidId, reason, note.trim())
      success.value = cancelSuccessMessage(r)
      return true
    } catch (e) {
      if (isEndpointMissing(e)) cancelUnavailable.value = true
      error.value = cancelErrorMessage(e)
      return false
    } finally {
      busy.value = false
    }
  }

  async function openDispute(bidId: string, party: DisputeParty, reason: AdminDisputeReason, description: string): Promise<boolean> {
    if (busy.value) return false
    busy.value = true; error.value = null; success.value = null
    try {
      const r = await bidsAdminService.openDispute(bidId, party, reason, description.trim())
      success.value = disputeSuccessMessage(r)
      return true
    } catch (e) {
      if (isEndpointMissing(e)) disputeUnavailable.value = true
      error.value = disputeErrorMessage(e)
      return false
    } finally {
      busy.value = false
    }
  }

  function reset() { error.value = null; success.value = null }

  return { busy, error, success, cancelUnavailable, disputeUnavailable, cancel, openDispute, reset }
}
