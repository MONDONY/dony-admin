import { bidRoute, gate, paymentRoute, userRoute, walletRefundRoute, type AdminRoute, type CanFn } from '@/lib/adminLinks'
import { mobileMoneyKindLabel } from '@/features/finance/components/mobileMoneyStatus'
import type { AdminMobileMoneyPayment } from '@/features/finance/types/index'

export interface MobileMoneyLinks {
  /** Fiche colis (BID_VIEW). */
  bid: AdminRoute | null
  /** Fiche de la personne (USER_VIEW). */
  person: AdminRoute | null
  /** Lien principal vers l'objet métier de l'opération (paiement, demande de remboursement). */
  main: { label: string; route: AdminRoute } | null
  /** « Relancer depuis le paiement » : le geste reste dans le tiroir du paiement. */
  retry: AdminRoute | null
}

/**
 * Liens sortants d'une opération, selon son motif (`purpose`). Chaque lien passe par le registre
 * et la permission de sa destination ; sans elle ou sans identifiant : `null` (du texte).
 * - BID_PAYMENT (ou ancien back, sans motif) : colis, personne, « Ouvrir le paiement ».
 * - WALLET_TOPUP : la personne seule, sur son onglet Argent.
 * - WALLET_REFUND : la demande de remboursement quand elle est connue ; la personne sinon.
 * - BID_SUPPLEMENT : le colis, sur son onglet Argent.
 */
export function mobileMoneyLinks(op: AdminMobileMoneyPayment, can: CanFn): MobileMoneyLinks {
  const purpose = op.purpose ?? 'BID_PAYMENT'
  const money = purpose === 'WALLET_TOPUP' || purpose === 'WALLET_REFUND'
  const person = gate(can, 'USER_VIEW', userRoute(op.personId, money ? 'money' : undefined))
  const bid = gate(can, 'BID_VIEW', bidRoute(op.bidId, purpose === 'BID_SUPPLEMENT' ? 'money' : undefined))

  let main: MobileMoneyLinks['main'] = null
  if (purpose === 'WALLET_REFUND') {
    const route = gate(can, 'PAYMENT_VIEW', walletRefundRoute(op.walletRefundRequestId))
    if (route) main = { label: 'Ouvrir la demande de remboursement', route }
  } else if (purpose === 'BID_PAYMENT') {
    const route = gate(can, 'PAYMENT_VIEW', paymentRoute(op.paymentId))
    if (route) main = { label: 'Ouvrir le paiement', route }
  }
  const retry = op.retryable ? gate(can, 'PAYMENT_VIEW', paymentRoute(op.paymentId, 'incidents')) : null
  return { bid, person, main, retry }
}

const PURPOSE_LABELS: Record<string, string> = {
  WALLET_TOPUP: 'Recharge du solde', WALLET_REFUND: 'Remboursement du solde', BID_SUPPLEMENT: 'Supplément',
}

/** Sens de l'opération, plus son motif quand il n'est pas évident (recharge, solde, supplément). */
export function mobileMoneyTypeLabel(op: Pick<AdminMobileMoneyPayment, 'kind' | 'purpose'>): { kind: string; purpose: string | null } {
  return { kind: mobileMoneyKindLabel(op.kind), purpose: (op.purpose && PURPOSE_LABELS[op.purpose]) || null }
}

export function mobileMoneyRoleLabel(role: string | null | undefined): string | null {
  return (role && { SENDER: 'Expéditeur', TRAVELER: 'Voyageur', USER: 'Utilisateur' }[role]) || null
}
