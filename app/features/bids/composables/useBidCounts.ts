import { ref } from 'vue'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminBidCounts, BidsFilterState } from '@/features/bids/types/index'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

/** Nombres par vue ; endpoint absent (back pas encore déployé) = fonctionnalité indisponible, pas une erreur. */
export function useBidCounts(filters: BidsFilterState) {
  const counts = ref<AdminBidCounts | null>(null)
  const unavailable = ref(false)
  const error = ref<string | null>(null)
  /** Une première réponse est arrivée (nombres, endpoint absent ou erreur). */
  const settled = ref(false)
  let seq = 0
  let lastKey: string | null = null

  /** Filtres dont dépendent les nombres (ni la vue, ni le statut, ni l'alerte ; la portée seulement avec un texte). */
  const keyOf = () => JSON.stringify([filters.announcementId, filters.query.trim(), filters.query.trim() ? filters.scope : 'ALL', filters.paymentMethod, filters.content.trim(), filters.dateFrom, filters.dateTo])

  async function reload(): Promise<void> {
    lastKey = keyOf()
    const my = ++seq
    error.value = null
    try {
      const res = await bidsAdminService.counts(filters)
      if (my !== seq) return
      counts.value = res
      unavailable.value = false
    } catch (e) {
      if (my !== seq) return
      if (isEndpointMissing(e)) { unavailable.value = true; counts.value = null }
      else {
        error.value = extractProblemMessage(e, 'Impossible de charger les nombres')
        // Un échec n'est pas un état acquis : le prochain `sync` réessaiera.
        lastKey = null
      }
    } finally {
      if (my === seq) settled.value = true
    }
  }

  /** Recharge seulement si un filtre qui compte a changé depuis le dernier chargement. */
  async function sync(): Promise<void> {
    if (keyOf() === lastKey) return
    await reload()
  }

  return { counts, unavailable, error, settled, reload, sync }
}
