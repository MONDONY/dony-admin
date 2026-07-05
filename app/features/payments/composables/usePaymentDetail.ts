import { ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import type { AdminPaymentDetail } from '@/features/payments/types/index'

export function usePaymentDetail() {
  const payment = ref<AdminPaymentDetail | null>(null)
  const error = ref<string | null>(null)
  const busy = ref(false)

  async function open(id: string) {
    error.value = null
    try { payment.value = await paymentsService.get(id) } catch (e) { error.value = (e as Error).message }
  }
  function close() { payment.value = null; error.value = null }

  /** Retourne true si l'action a réussi (permet à la page de fermer le panneau). */
  async function run(fn: () => Promise<AdminPaymentDetail>): Promise<boolean> {
    error.value = null
    busy.value = true
    try {
      payment.value = await fn()
      return true
    } catch (e) {
      error.value = (e as Error).message || 'Action échouée'
      return false
    } finally {
      busy.value = false
    }
  }
  const forceRelease = () => run(() => paymentsService.forceRelease(payment.value!.id))
  const refund = () => run(() => paymentsService.refund(payment.value!.id))
  return { payment, error, busy, open, close, forceRelease, refund }
}
