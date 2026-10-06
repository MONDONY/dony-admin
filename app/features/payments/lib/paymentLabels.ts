import { bidStatusMeta } from '@/features/bids/components/bidStatus'
import type { BidStatus } from '@/features/bids/types/index'
import type { PaymentInsight } from '@/features/payments/types/index'

/** Libellés des étapes de la chronologie d'un paiement (codes du journal d'audit du back). */
const ACTIONS: Record<string, string> = {
  PAYMENT_CREATED: 'Paiement créé',
  PAYMENT_CAPTURED: 'Carte débitée (capture)',
  ESCROW_RELEASED: 'Séquestre libéré',
  PAYMENT_ESCROW_CREATED: 'Paiement par carte lancé',
  NEGOTIATION_ESCROW_CREATED: 'Paiement de négociation lancé',
  NEGOTIATION_ESCROW_CANCELED: 'Paiement de négociation annulé',
  PAYMENT_ESCROW_ACTIVE: 'Fonds en séquestre',
  PAYMENT_CAPTURED_ON_PLATFORM: 'Fonds capturés sur la plateforme',
  PAYMENT_INTENT_CANCELED: 'Paiement Stripe annulé',
  PAYMENT_FAILED: 'Paiement échoué',
  PAYMENT_REFUNDED: 'Remboursé',
  PAYMENT_PARTIALLY_REFUNDED: 'Remboursé en partie',
  PAYMENT_DISPUTED: 'Litige bancaire ouvert',
  REFUND_FAILED: 'Remboursement échoué',
  REFUND_AFTER_RELEASE: 'Remboursé après versement au voyageur',
  ESCROW_FORCE_RELEASED: 'Versement forcé par un admin',
  ESCROW_FORCE_REFUNDED: 'Remboursement forcé par un admin',
  PAYOUT_HELD_BENEFICIARY: 'Versement retenu (voyageur gelé)',
  PAYOUT_HOLD_OVERRIDDEN_BY_ADMIN: 'Retenue levée par dérogation admin',
  PAYOUT_BLOCKED_STRIPE_ACCOUNT_UNUSABLE: 'Versement bloqué : compte Stripe du voyageur inutilisable',
  DELIVERY_TRANSFER_BLOCKED_CHARGEBACK: 'Versement bloqué : litige bancaire',
  DELIVERY_TRANSFER_BLOCKED_PARTIAL_REFUND: 'Versement bloqué : déjà remboursé en partie',
  DELIVERY_PAYMENT_NOT_IN_ESCROW: 'Colis livré sans séquestre',
  COMMISSION_CHARGED_WALLET: 'Commission prélevée sur le portefeuille',
  COMMISSION_REFUNDED_TO_WALLET: 'Commission remboursée sur le portefeuille',
  MM_PAYMENT_CREATED: 'Paiement mobile money lancé',
  MM_ESCROW: 'Dépôt mobile money reçu (séquestre)',
  MM_DEPOSIT_FAILED: 'Dépôt mobile money échoué',
  MM_PAYOUT_COMPLETED: 'Versement mobile money effectué',
  MM_PAYOUT_FAILED: 'Versement mobile money échoué',
  MM_PAYOUT_RETRIED: 'Versement mobile money relancé par un admin',
  MM_REFUND_COMPLETED: 'Remboursement mobile money effectué',
  MM_REFUND_FAILED: 'Remboursement mobile money échoué',
  MM_REFUND_RETRIED: 'Remboursement mobile money relancé par un admin',
}

/** Code inconnu : rendu lisible (`SOME_ACTION` → « Some action »). */
export function timelineActionLabel(action: string): string {
  if (ACTIONS[action]) return ACTIONS[action]
  const words = action.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function paymentKindLabel(kind: PaymentInsight['kind'] | undefined | null): string {
  return kind === 'NEGOTIATION' ? 'Négociation' : 'Colis'
}

export function routeLabel(i: PaymentInsight | null | undefined): string | null {
  if (!i || (!i.departureCity && !i.arrivalCity)) return null
  return `${i.departureCity ?? '?'} → ${i.arrivalCity ?? '?'}`
}

/** Statut du colis en clair ; un statut inconnu du front reste affiché tel quel. */
export function bidStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null
  return bidStatusMeta(status as BidStatus)?.label ?? status
}

/** Identifiant raccourci pour l'affichage (le complet reste en infobulle). */
export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '—'
}
