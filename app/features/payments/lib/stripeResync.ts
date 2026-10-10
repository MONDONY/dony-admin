import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'
import { OVERRIDABLE_CONFLICT_CODES, STRIPE_ACCOUNT_UNUSABLE, TRANSFER_ALREADY_ATTEMPTED } from '@/features/payments/types/index'

/**
 * Libellés de la resynchronisation Stripe (`POST /admin/payments/{id}/resync-stripe`, back #487)
 * et des erreurs des deux gestes de correction proposés depuis une alerte (resynchroniser,
 * forcer le versement).
 */

const ACTIONS: Record<string, string> = {
  ALREADY_IN_SYNC: 'Déjà à jour, rien à faire',
  ESCROW_ACTIVATED: 'Paiement passé en séquestre et encaissé',
  ESCROW_CAPTURED: 'Séquestre encaissé : le voyageur pourra être payé',
  CAPTURE_RECORDED: 'Encaissement Stripe enregistré chez Yadony',
  MARKED_FAILED: 'Paiement marqué échoué (la carte a été refusée chez Stripe)',
  MARKED_CANCELLED: 'Paiement marqué annulé (annulé chez Stripe)',
  ESCROW_RELEASED: 'Colis déjà livré : versement envoyé au voyageur',
}

export function resyncActionLabel(action: string): string {
  return ACTIONS[action] ?? action
}

const STRIPE_STATUSES: Record<string, string> = {
  requires_payment_method: 'Moyen de paiement à fournir',
  requires_confirmation: 'À confirmer',
  requires_action: 'Action du client requise (3D Secure)',
  processing: 'En cours de traitement',
  requires_capture: 'Autorisé, non encaissé',
  succeeded: 'Encaissé',
  canceled: 'Annulé',
}

export function stripeStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return STRIPE_STATUSES[status] ? `${STRIPE_STATUSES[status]} (${status})` : status
}

/** Message affiché quand le serveur ne connaît pas encore l'action (back #487 pas déployé). */
export const RESYNC_UNAVAILABLE = 'Action indisponible sur cet environnement : le serveur n’est pas encore à jour.'

const RESYNC_ERRORS: Record<string, string> = {
  'authorization-expired': 'Autorisation carte expirée : il n’y a plus rien à encaisser. Remboursez ou recontactez l’expéditeur pour qu’il paie à nouveau.',
  'amount-mismatch': 'Le montant ou la devise autorisés chez Stripe ne correspondent pas au paiement : rien n’a été encaissé. Transmettez à l’équipe technique.',
  'escrow-capture-failed': 'Stripe a refusé l’encaissement de la carte : rien n’a été versé, le paiement reste en séquestre. Une alerte « Encaissement du séquestre impossible » a été levée.',
  'resync-not-supported': 'Situation que la resynchronisation ne sait pas corriger seule : vérifiez le paiement dans Stripe et transmettez à l’équipe technique.',
  'payment-intent-not-found': 'PaymentIntent introuvable chez Stripe : vérifiez la référence dans le dashboard Stripe.',
  'not-a-card-payment': 'Ce paiement n’est pas un paiement carte (mobile money ou sans PaymentIntent) : rien à resynchroniser avec Stripe.',
  'payment-not-found': 'Paiement introuvable.',
  'stripe-unavailable': 'Stripe injoignable, réessayez dans quelques instants.',
}

function statusOf(e: unknown): number | undefined {
  const err = e as { statusCode?: number; status?: number; response?: { status?: number } } | undefined
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

/** Erreur d'un appel `resync-stripe`, en français. */
export function resyncErrorMessage(e: unknown): string {
  if (isEndpointMissing(e)) return RESYNC_UNAVAILABLE
  if (statusOf(e) === 403) return 'Action réservée aux super-administrateurs.'
  const code = problemCode(e)
  if (code && RESYNC_ERRORS[code]) return RESYNC_ERRORS[code]
  return extractProblemMessage(e, 'Resynchronisation impossible')
}

/** Erreur d'un `force-release` lancé depuis une alerte (la dérogation se fait sur la fiche paiement). */
export function forceReleaseErrorMessage(e: unknown): string {
  if (statusOf(e) === 403) return 'Action réservée aux super-administrateurs.'
  const code = problemCode(e)
  if (code === 'escrow-capture-failed') {
    return 'Encaissement de la carte impossible : aucun versement n’est parti, le paiement reste en séquestre. Resynchronisez avec Stripe, ou remboursez si l’autorisation a expiré.'
  }
  if (code && (OVERRIDABLE_CONFLICT_CODES as readonly string[]).includes(code)) {
    return 'Versement bloqué (voyageur gelé ou litige bancaire) : ouvrez la fiche paiement pour payer par une dérogation motivée.'
  }
  if (code === STRIPE_ACCOUNT_UNUSABLE) {
    return 'Le compte Stripe du voyageur est inutilisable : aucun versement ne peut lui parvenir. Remboursez l’expéditeur ou demandez au voyageur de régulariser son compte.'
  }
  if (code === TRANSFER_ALREADY_ATTEMPTED) {
    return 'Un transfert Stripe a déjà été tenté pour ce paiement : vérifiez dans Stripe avant toute autre action, relancer risquerait de payer deux fois.'
  }
  return extractProblemMessage(e, 'Versement impossible')
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuidOrNull = (v: unknown): string | null => (typeof v === 'string' && UUID.test(v) ? v : null)

/** Types d'alerte dont le suffixe est l'identifiant du paiement visé. */
const PAYMENT_SUFFIXED = ['RECON_STRIPE_', 'ESCROW_CAPTURE_FAILED_', 'DELIVERY_NOT_ESCROW_', 'LATE_RELEASE_FAILED_'] as const

/** Alertes de séquestre carte que la section « Corriger » sait traiter. */
export function isStripeFixAlert(type: string): boolean {
  return type.startsWith('ESCROW_J48_TIMEOUT') || PAYMENT_SUFFIXED.some(p => type.startsWith(p))
}

/**
 * Paiement visé par une alerte : `paymentId` du nouveau back, sinon `payload.paymentId`, sinon
 * (ancien back) `payload.reference` ou le suffixe du type pour `RECON_STRIPE_` et
 * `ESCROW_CAPTURE_FAILED_`, `DELIVERY_NOT_ESCROW_` et `LATE_RELEASE_FAILED_`. Un écart de commission (`COMMISSION_*`) vise un colis, pas un paiement.
 */
export function alertPaymentId(alert: { type: string; payload?: Record<string, unknown> | null; paymentId?: string | null }): string | null {
  const direct = uuidOrNull(alert.paymentId) ?? uuidOrNull(alert.payload?.paymentId)
  if (direct) return direct
  const ecart = alert.payload?.ecart
  if (alert.type.startsWith('RECON_') && typeof ecart === 'string' && ecart.startsWith('COMMISSION_')) return null
  const prefix = PAYMENT_SUFFIXED.find(p => alert.type.startsWith(p))
  if (!prefix) return null
  return uuidOrNull(alert.payload?.reference) ?? uuidOrNull(alert.type.slice(prefix.length))
}
