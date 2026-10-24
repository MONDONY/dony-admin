import { bidStatusMeta } from '@/features/bids/components/bidStatus'
import type { BidStatus } from '@/features/bids/types/index'
import type { PaymentInsight } from '@/features/payments/types/index'
import { parseServerDate } from '@/lib/serverDate'

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
  DELIVERY_TRANSFER_BLOCKED_DISPUTE: 'Versement gelé : litige ouvert par un admin',
  TRANSFER_ALREADY_EXISTS_REALIGNED: 'Versement déjà parti chez Stripe : aucun second virement',
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

const CHARGEBACK: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  OPEN: { label: 'Ouvert', tone: 'warning' },
  WON: { label: 'Gagné', tone: 'success' },
  LOST: { label: 'Perdu', tone: 'danger' },
}
/** Statut d'un litige bancaire en clair ; un statut inconnu reste affiché tel quel, en neutre. */
export function chargebackStatusMeta(status: string): { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' } {
  return CHARGEBACK[status] ?? { label: status, tone: 'neutral' }
}

/** Identifiant raccourci pour l'affichage (le complet reste en infobulle). */
export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '—'
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Ancienneté d'un paiement pour la colonne « Depuis » : « il y a 4 j » et « 19 oct. » (l'année
 * seulement si elle diffère de celle d'aujourd'hui). Date du serveur lue en UTC ; illisible : null.
 */
export function paymentAge(iso: string | null | undefined, now: number = Date.now()): { relative: string; day: string } | null {
  const at = parseServerDate(iso)
  if (Number.isNaN(at)) return null
  const elapsed = now - at
  const relative = elapsed < MINUTE ? 'à l’instant'
    : elapsed < HOUR ? `il y a ${Math.floor(elapsed / MINUTE)} min`
      : elapsed < DAY ? `il y a ${Math.floor(elapsed / HOUR)} h`
        : `il y a ${Math.floor(elapsed / DAY)} j`
  const date = new Date(at)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  const day = date.toLocaleDateString('fr-FR', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
  return { relative, day }
}

/** Texte de recherche d'un trajet suggéré : « Paris Dakar » (la recherche serveur exige chaque mot). */
export function tripSearchText(trip: { departureCity: string; arrivalCity: string }): string {
  return [trip.departureCity, trip.arrivalCity].map(c => c?.trim()).filter(Boolean).join(' ')
}
