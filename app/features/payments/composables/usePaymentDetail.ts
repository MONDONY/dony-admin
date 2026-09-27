import { ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { problemCode } from '@/lib/endpointMissing'
import { OVERRIDABLE_CONFLICT_CODES, STRIPE_ACCOUNT_UNUSABLE } from '@/features/payments/types/index'
import type { AdminPaymentDetail, PayoutAction, PayoutOverride } from '@/features/payments/types/index'

/** 409 reçu sur un geste qui paie le voyageur : le panneau propose alors la dérogation. */
export interface PayoutOverrideRequest { action: PayoutAction; code: string }

const CONFLICT_MESSAGES: Record<string, string> = {
  'payout-beneficiary-held':
    'Versement retenu : le voyageur est banni ou son identité a été révoquée. Pour le payer quand même, confirmez une dérogation motivée.',
  'payment-disputed':
    'Ce paiement fait l’objet d’un litige bancaire ouvert. Pour payer le voyageur quand même, confirmez une dérogation motivée.',
  [STRIPE_ACCOUNT_UNUSABLE]:
    'Le compte Stripe du voyageur est inutilisable : aucun versement ne peut lui parvenir. Remboursez l’expéditeur ou demandez au voyageur de régulariser son compte.',
}

export function usePaymentDetail() {
  const payment = ref<AdminPaymentDetail | null>(null)
  const error = ref<string | null>(null)
  const busy = ref(false)
  const overrideRequest = ref<PayoutOverrideRequest | null>(null)

  async function open(id: string) {
    error.value = null
    try { payment.value = await paymentsService.get(id) } catch (e) { error.value = extractProblemMessage(e, 'Impossible de charger le paiement') }
  }
  function close() { payment.value = null; error.value = null; overrideRequest.value = null }
  function dismissOverride() { overrideRequest.value = null }

  /**
   * Retourne true si l'action a réussi, false si l'API renvoie une erreur. Chaque action du
   * back renvoie le détail à jour : il remplace celui affiché, sans second GET. Pour un geste
   * qui paie le voyageur (`payout`), les 409 de blocage basculent en demande de dérogation :
   * c'est ainsi qu'un paiement dont le détail ne portait pas encore la retenue est rattrapé.
   */
  async function run(fn: () => Promise<AdminPaymentDetail>, payout?: PayoutAction): Promise<boolean> {
    error.value = null
    busy.value = true
    try {
      payment.value = await fn()
      overrideRequest.value = null
      return true
    } catch (e) {
      const code = payout ? problemCode(e) : null
      if (code && (OVERRIDABLE_CONFLICT_CODES as readonly string[]).includes(code)) {
        overrideRequest.value = { action: payout!, code }
        error.value = CONFLICT_MESSAGES[code]!
      } else if (code === STRIPE_ACCOUNT_UNUSABLE) {
        overrideRequest.value = null
        error.value = CONFLICT_MESSAGES[code]!
      } else {
        error.value = extractProblemMessage(e, 'Action échouée')
      }
      return false
    } finally {
      busy.value = false
    }
  }
  const forceRelease = (override?: PayoutOverride) =>
    run(() => override ? paymentsService.forceRelease(payment.value!.id, override) : paymentsService.forceRelease(payment.value!.id), 'release')
  const refund = () => run(() => paymentsService.refund(payment.value!.id))
  const retryPayout = (override?: PayoutOverride) =>
    run(() => override
      ? paymentsService.retryMobileMoneyPayout(payment.value!.id, override)
      : paymentsService.retryMobileMoneyPayout(payment.value!.id), 'retry-payout')
  const retryRefund = () => run(() => paymentsService.retryMobileMoneyRefund(payment.value!.id))
  return { payment, error, busy, overrideRequest, open, close, dismissOverride, forceRelease, refund, retryPayout, retryRefund }
}
