import type { AdminWalletRefundRequest, WalletRefundRetryPreview } from '@/features/finance/types/index'
import { WALLET_REFUND_FAILURE_LABELS } from '@/features/finance/types/index'

/**
 * Relance d'un remboursement de solde mobile money : seulement un ticket manuel en attente dont
 * les recharges viennent du mobile money. `sourceRail` absent (ancien backend) : on propose quand
 * même le bouton, l'aperçu répondra 422 si la demande n'est pas éligible.
 */
export function canRetryWalletRefund(r: AdminWalletRefundRequest): boolean {
  if (r.status !== 'PENDING' || (r.channel != null && r.channel !== 'MANUAL_ADMIN')) return false
  return r.sourceRail === undefined || r.sourceRail === 'PAWAPAY'
}

/** Nom du pays en français (« Côte d’Ivoire »), le code tel quel si le navigateur l'ignore. */
export function countryLabel(code: string | null | undefined): string {
  if (!code) return '—'
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code.toUpperCase()) ?? code
  }
  catch {
    return code
  }
}

/** Libellé d'un motif d'échec ; un motif inconnu s'affiche tel quel. */
export function failureLabel(reason: string | null | undefined): string | null {
  if (!reason) return null
  return WALLET_REFUND_FAILURE_LABELS[reason] ?? reason
}

/**
 * Pourquoi « Verser maintenant » reste fermé, en français ; `null` si l'envoi est possible.
 * La relance verse le dû entier : jamais de montant partiel, l'écart serait perdu pour
 * l'utilisateur.
 */
export function retryBlocker(p: WalletRefundRetryPreview | null): string | null {
  if (!p) return 'Aperçu indisponible.'
  if (p.walletBalance == null || p.unavailableReason === 'pawapay-balance-unavailable') {
    return 'Solde du wallet pawaPay illisible : actualisez dans quelques instants.'
  }
  if (!p.retryAvailable || p.suggestedAmount == null) {
    return 'Le wallet pawaPay ne couvre pas encore le montant dû.'
  }
  return null
}
