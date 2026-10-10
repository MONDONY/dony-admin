import { ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { resyncErrorMessage } from '@/features/payments/lib/stripeResync'
import type { StripeResyncResult } from '@/features/payments/types/index'

/**
 * Endpoint absent (back #487 pas encore déployé : 404/405 sans code métier) : retenu pour la
 * session, le bouton disparaît de toutes les fiches au lieu d'échouer à chaque clic.
 */
const unavailable = ref(false)

/** Pour les tests : l'indisponibilité est partagée entre instances. */
export function resetStripeResyncAvailability() { unavailable.value = false }

export function useStripeResync() {
  const result = ref<StripeResyncResult | null>(null)
  const error = ref<string | null>(null)
  const busy = ref(false)

  /** Null en cas d'erreur, ou si un appel est déjà en cours (double clic : un seul appel). */
  async function resync(paymentId: string): Promise<StripeResyncResult | null> {
    if (busy.value) return null
    busy.value = true
    error.value = null
    try {
      const r = await paymentsService.resyncStripe(paymentId)
      result.value = r
      return r
    } catch (e) {
      if (isEndpointMissing(e)) unavailable.value = true
      else error.value = resyncErrorMessage(e)
      return null
    } finally {
      busy.value = false
    }
  }

  function reset() { result.value = null; error.value = null }

  return { result, error, busy, unavailable, resync, reset }
}
