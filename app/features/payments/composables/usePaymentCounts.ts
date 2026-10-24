import { ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import type { PaymentViewCounts, PaymentsFilterState } from '@/features/payments/types/index'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

/** Nombres par vue ; endpoint absent (back pas encore déployé) = fonctionnalité indisponible, pas une erreur. */
export function usePaymentCounts(filters: PaymentsFilterState) {
  const counts = ref<PaymentViewCounts | null>(null)
  const unavailable = ref(false)
  const error = ref<string | null>(null)
  /** Une première réponse est arrivée (nombres, endpoint absent ou erreur). */
  const settled = ref(false)
  let seq = 0
  let lastKey: string | null = null

  /** Filtres dont dépendent les nombres : le serveur ignore la vue, l'alerte et le statut. */
  const keyOf = () => JSON.stringify([
    filters.query?.trim() ?? '', filters.method, filters.currency, filters.dateFrom, filters.dateTo, filters.held,
    filters.hideAbandoned, filters.partyId ?? '', filters.announcementId ?? '', filters.bidId ?? '',
    filters.amountMin ?? null, filters.amountMax ?? null,
  ])

  async function reload(): Promise<void> {
    lastKey = keyOf()
    const my = ++seq
    error.value = null
    try {
      const res = await paymentsService.counts(filters)
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
