import { ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import type { AdminPaymentDetail } from '@/features/payments/types/index'

export function usePaymentDetail() {
  const payment = ref<AdminPaymentDetail | null>(null)
  const error = ref<string | null>(null)
  async function open(id: string) {
    error.value = null
    try { payment.value = await paymentsService.get(id) } catch (e) { error.value = (e as Error).message }
  }
  function close() { payment.value = null }
  async function run(fn: () => Promise<AdminPaymentDetail>) {
    error.value = null
    try { payment.value = await fn() } catch (e) { error.value = (e as Error).message }
  }
  const forceRelease = () => run(() => paymentsService.forceRelease(payment.value!.id))
  const refund = () => run(() => paymentsService.refund(payment.value!.id))
  return { payment, error, open, close, forceRelease, refund }
}
