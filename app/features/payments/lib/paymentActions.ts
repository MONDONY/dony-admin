import type { AdminPaymentDetail } from '../types/index'
import type { CanFn } from '@/lib/adminLinks'

export type PaymentActionId = 'release' | 'refund' | 'retry-payout' | 'retry-refund'
export interface PaymentAction {
  id: PaymentActionId
  label: string
  enabled: boolean
  /** Pourquoi le geste est impossible ; absent quand il est possible. */
  reason?: string
  tone: 'success' | 'warning' | 'primary'
  /** Paiement retenu : le geste passe par la dérogation motivée, pas par le dialogue habituel. */
  override: boolean
}

const FORBIDDEN_RELEASE = 'Permission manquante : réservé aux admins qui peuvent débloquer les paiements.'
const FORBIDDEN_REFUND = 'Permission manquante : réservé aux admins qui peuvent rembourser.'
const NOT_ESCROW_RELEASE = 'Seul un paiement en séquestre peut être débloqué.'
const NOT_ESCROW_REFUND = 'Seul un paiement en séquestre peut être remboursé depuis l’admin.'
const NOT_MOBILE_MONEY = 'Réservé aux paiements mobile money.'

/** Première raison qui bloque, dans l'ordre : permission, rail, statut, opération connue. */
function firstReason(...checks: [blocked: boolean, reason: string][]): string | undefined {
  return checks.find(([blocked]) => blocked)?.[1]
}

/**
 * Gestes du menu « Actions » du tiroir paiement, avec EXACTEMENT les gardes de l'ancien panneau
 * (elles-mêmes calquées sur AdminPaymentController) : déblocage `PAYMENT_RELEASE` et
 * remboursement `PAYMENT_REFUND` sur un paiement en séquestre ; relances mobile money sur le rail
 * pawaPay, au bon statut, avec une opération du bon type déjà connue (sans elle le back répond
 * « introuvable »), toutes deux sous `PAYMENT_RELEASE`. Un geste impossible est rendu avec sa
 * raison, jamais caché. `held` : le déblocage et la relance du versement passent par la dérogation.
 */
export function paymentActions(p: AdminPaymentDetail, can: CanFn, held: boolean): PaymentAction[] {
  const canRelease = can('PAYMENT_RELEASE')
  const mobileMoney = p.method === 'PAWAPAY'
  const escrow = p.status === 'ESCROW'
  const build = (id: PaymentActionId, label: string, tone: PaymentAction['tone'], override: boolean, reason: string | undefined): PaymentAction =>
    (reason ? { id, label, tone, override, enabled: false, reason } : { id, label, tone, override, enabled: true })

  return [
    build('release', held ? 'Payer le voyageur (dérogation)' : 'Débloquer (force-release)', 'success', held,
      firstReason([!canRelease, FORBIDDEN_RELEASE], [!escrow, NOT_ESCROW_RELEASE])),
    build('refund', 'Rembourser l’expéditeur', 'warning', false,
      firstReason([!can('PAYMENT_REFUND'), FORBIDDEN_REFUND], [!escrow, NOT_ESCROW_REFUND])),
    build('retry-payout', 'Relancer le versement', 'primary', held, firstReason(
      [!canRelease, FORBIDDEN_RELEASE],
      [!mobileMoney, NOT_MOBILE_MONEY],
      [p.status !== 'RELEASED', 'Seulement sur un paiement mobile money déjà versé au voyageur.'],
      [p.pawapayPayoutId == null, 'Aucun versement mobile money connu pour ce paiement : rien à relancer.'],
    )),
    build('retry-refund', 'Relancer le remboursement', 'warning', false, firstReason(
      [!canRelease, FORBIDDEN_RELEASE],
      [!mobileMoney, NOT_MOBILE_MONEY],
      [p.status !== 'REFUNDED' && p.status !== 'CANCELLED', 'Seulement sur un paiement mobile money remboursé ou annulé.'],
      [p.pawapayRefundId == null, 'Aucun remboursement mobile money connu pour ce paiement : rien à relancer.'],
    )),
  ]
}
