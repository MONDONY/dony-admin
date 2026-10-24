import { ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { problemCode } from '@/lib/endpointMissing'
import {
  OVERRIDABLE_CONFLICT_CODES, OVERRIDE_REASON_INVALID, STRIPE_ACCOUNT_UNUSABLE, TRANSFER_ALREADY_ATTEMPTED,
  stripeAccountStatusLabel,
} from '@/features/payments/types/index'
import type { AdminPaymentDetail, PayoutAction, PayoutOverride } from '@/features/payments/types/index'

/**
 * 409 de blocage reçu sur un geste qui paie le voyageur : le panneau propose alors la
 * dérogation. `blockers` et `holdReasons` viennent du ProblemDetail (listes vides s'il ne
 * les porte pas) : un litige bancaire et un compte gelé peuvent coexister.
 */
export interface PayoutOverrideRequest {
  action: PayoutAction; code: string
  blockers: string[]; holdReasons: string[]; travelerId: string | null
}

type ProblemData = { blockers?: unknown; holdReasons?: unknown; travelerId?: unknown; stripeAccountStatus?: unknown } | undefined

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function conflictMessage(code: string, blockers: string[]): string {
  if (blockers.includes('DISPUTED') && blockers.includes('BENEFICIARY_HELD')) {
    return 'Deux blocages : le compte du voyageur est gelé et le paiement fait l’objet d’un litige bancaire. Pour le payer quand même, confirmez une dérogation motivée.'
  }
  if (code === 'payment-disputed' || blockers.includes('DISPUTED')) {
    return 'Ce paiement fait l’objet d’un litige bancaire ouvert. Pour payer le voyageur quand même, confirmez une dérogation motivée.'
  }
  return 'Versement retenu : le voyageur est banni ou son identité a été révoquée. Pour le payer quand même, confirmez une dérogation motivée.'
}

export function usePaymentDetail() {
  const payment = ref<AdminPaymentDetail | null>(null)
  const error = ref<string | null>(null)
  /** Refus du motif de dérogation (422) : affiché dans le dialogue, à côté de la saisie. */
  const overrideError = ref<string | null>(null)
  const busy = ref(false)
  const overrideRequest = ref<PayoutOverrideRequest | null>(null)
  /**
   * Numéro de la dernière ouverture ou fermeture : une lecture qui répond après la fermeture du
   * tiroir (ou l'ouverture d'une autre fiche) ne réécrit rien, le tiroir ne réapparaît pas.
   */
  let generation = 0

  async function open(id: string) {
    const mine = ++generation
    error.value = null
    try {
      const result = await paymentsService.get(id)
      if (mine === generation) payment.value = result
    } catch (e) {
      if (mine === generation) error.value = extractProblemMessage(e, 'Impossible de charger le paiement')
    }
  }
  /**
   * Relit la fiche après un geste réussi : la réponse du geste ne porte pas les champs de
   * lecture (liens, alerte, n° de suivi…). En échec, le détail renvoyé par le geste reste
   * affiché et aucune erreur ne s'ajoute : le geste, lui, a réussi.
   */
  async function reload(id: string) {
    try {
      const result = await paymentsService.get(id)
      // Fiche fermée ou autre fiche ouverte pendant la lecture : rien à réécrire.
      if (payment.value?.id === id) payment.value = result
    } catch { /* détail du geste conservé */ }
  }
  function close() { generation++; payment.value = null; error.value = null; overrideRequest.value = null; overrideError.value = null }
  function dismissOverride() { overrideRequest.value = null; overrideError.value = null }

  /**
   * Retourne true si l'action a réussi, false si l'API renvoie une erreur. Chaque action du
   * back renvoie le détail à jour : il remplace aussitôt celui affiché, puis la page le relit
   * (`reload`) pour les champs que seule la lecture porte. Pour un geste
   * qui paie le voyageur (`payout`), les 409 de blocage basculent en demande de dérogation :
   * c'est ainsi qu'un paiement dont le détail ne portait pas encore la retenue est rattrapé.
   * Un 422 `payment-not-in-escrow` (vérifié par le back avant le gel) reste une erreur ordinaire.
   */
  async function run(fn: () => Promise<AdminPaymentDetail>, payout?: PayoutAction): Promise<boolean> {
    error.value = null
    overrideError.value = null
    busy.value = true
    const id = payment.value?.id
    try {
      const result = await fn()
      // Le geste a réussi même si la fiche a été fermée entre-temps : elle ne se rouvre pas.
      if (id !== undefined && payment.value?.id === id) payment.value = result
      overrideRequest.value = null
      return true
    } catch (e) {
      const code = payout ? problemCode(e) : null
      const data = (e as { data?: ProblemData } | undefined)?.data
      if (code && (OVERRIDABLE_CONFLICT_CODES as readonly string[]).includes(code)) {
        const blockers = strings(data?.blockers)
        overrideRequest.value = {
          action: payout!, code, blockers, holdReasons: strings(data?.holdReasons),
          travelerId: typeof data?.travelerId === 'string' ? data.travelerId : null,
        }
        error.value = conflictMessage(code, blockers)
      } else if (code === OVERRIDE_REASON_INVALID) {
        overrideError.value = extractProblemMessage(e, 'Le motif de dérogation doit faire entre 10 et 500 caractères.')
      } else if (code === STRIPE_ACCOUNT_UNUSABLE) {
        overrideRequest.value = null
        const status = stripeAccountStatusLabel(typeof data?.stripeAccountStatus === 'string' ? data.stripeAccountStatus : null)
        error.value = 'Le compte Stripe du voyageur est inutilisable'
          + (status ? ` (statut : ${status})` : '')
          + ' : aucun versement ne peut lui parvenir. Remboursez l’expéditeur ou demandez au voyageur de régulariser son compte.'
      } else if (code === TRANSFER_ALREADY_ATTEMPTED) {
        overrideRequest.value = null
        error.value = 'Un transfert Stripe a déjà été tenté pour ce paiement. Vérifiez dans Stripe ce qu’il est devenu avant toute autre action : relancer risquerait de payer le voyageur deux fois.'
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
  return { payment, error, overrideError, busy, overrideRequest, open, reload, close, dismissOverride, forceRelease, refund, retryPayout, retryRefund }
}
