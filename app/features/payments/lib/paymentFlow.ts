import { isPaymentHeld } from '../types/index'
import type { AdminPaymentDetail } from '../types/index'

export type PaymentFlowState = 'done' | 'current' | 'todo' | 'stop'
export interface PaymentFlowStep {
  id: 'paid' | 'captured' | 'delivered' | 'outcome'
  label: string
  /** Instant du serveur (à lire avec `parseServerDate`) ; absent quand le back ne le donne pas. */
  date?: string
  state: PaymentFlowState
}
export interface PaymentFlowModel { steps: PaymentFlowStep[] }

/** Argent autorisé ou encaissé : PENDING (intention non aboutie), FAILED et CANCELLED n'en sont pas. */
const PAID = new Set(['ESCROW', 'RELEASED', 'REFUNDED'])

/**
 * Parcours de l'argent d'un paiement, en une ligne : Payé → Encaissé → Colis livré → Versé (ou
 * Remboursé). Lu sur les champs du paiement, jamais deviné : une étape sans trace reste « à venir ».
 *
 * - Carte : « Encaissé » = capture enregistrée (`capturedAt`, à défaut celui du contexte) ; un
 *   paiement versé a forcément été encaissé, même si un ancien back n'en donne pas la date.
 * - Mobile money : l'argent est encaissé dès que le dépôt pawaPay est connu.
 * - Versement retenu (ou versement mobile money échoué) : la dernière étape est un arrêt.
 * - Checkout abandonné, paiement échoué ou annulé sans argent pris : arrêt dès la première étape.
 */
export function paymentFlow(p: AdminPaymentDetail): PaymentFlowModel {
  const abandoned = p.insight?.abandoned === true
  const capturedAt = p.capturedAt ?? p.insight?.capturedAt ?? null
  const mobileMoney = p.method === 'PAWAPAY'
  // Annulé : de l'argent avait été pris si un remboursement mobile money ou une capture existe.
  const cancelledAfterPayment = p.status === 'CANCELLED' && (p.pawapayRefundId != null || capturedAt != null)
  const paid = !abandoned && (PAID.has(p.status) || cancelledAfterPayment)

  const paidStep: PaymentFlowStep = abandoned ? { id: 'paid', label: 'Checkout abandonné', state: 'stop' }
    : p.status === 'FAILED' ? { id: 'paid', label: 'Paiement échoué', state: 'stop' }
      : p.status === 'CANCELLED' && !paid ? { id: 'paid', label: 'Paiement annulé', state: 'stop' }
        : paid ? { id: 'paid', label: 'Payé', state: 'done', ...(p.createdAt ? { date: p.createdAt } : {}) }
          : { id: 'paid', label: 'Payé', state: 'current' }
  const steps: PaymentFlowStep[] = [paidStep]
  if (!paid) {
    steps.push({ id: 'captured', label: 'Encaissé', state: 'todo' }, { id: 'delivered', label: 'Colis livré', state: 'todo' }, { id: 'outcome', label: 'Versé', state: 'todo' })
    return { steps }
  }

  const refunded = p.status === 'REFUNDED' || p.status === 'CANCELLED'
  const released = p.status === 'RELEASED'
  const captured = capturedAt != null || released || (mobileMoney && p.pawapayDepositId != null)
  steps.push(captured
    ? { id: 'captured', label: 'Encaissé', state: 'done', ...(capturedAt ? { date: capturedAt } : {}) }
    : { id: 'captured', label: 'Encaissé', state: refunded ? 'todo' : 'current' })

  const delivered = released || p.insight?.bidStatus === 'COMPLETED'
  steps.push({ id: 'delivered', label: 'Colis livré', state: delivered ? 'done' : captured && !refunded ? 'current' : 'todo' })

  if (refunded) steps.push({ id: 'outcome', label: 'Remboursé', state: 'done' })
  else if (isPaymentHeld(p)) steps.push({ id: 'outcome', label: 'Versement retenu', state: 'stop' })
  else if (p.alert === 'MM_FAILED') steps.push({ id: 'outcome', label: 'Versement échoué', state: 'stop' })
  else if (released) steps.push({ id: 'outcome', label: 'Versé', state: 'done', ...(p.escrowReleasedAt ? { date: p.escrowReleasedAt } : {}) })
  else steps.push({ id: 'outcome', label: 'Versé', state: delivered ? 'current' : 'todo' })
  return { steps }
}
