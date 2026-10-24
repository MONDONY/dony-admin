import type { PaymentAlertCode, PaymentView, PaymentViewCounts } from '../types/index'

/** Vues rapides de la page Transactions, dans l'ordre des pastilles. */
export const PAYMENT_VIEWS: { id: PaymentView; label: string; countKey: keyof PaymentViewCounts }[] = [
  { id: 'ATTENTION', label: 'À traiter', countKey: 'attention' },
  { id: 'ESCROW', label: 'En séquestre', countKey: 'escrow' },
  { id: 'RELEASED_RECENT', label: 'Versés (3 j)', countKey: 'releasedRecent' },
  { id: 'REFUNDED', label: 'Remboursés', countKey: 'refunded' },
  { id: 'FAILED', label: 'Échoués / annulés', countKey: 'failed' },
  { id: 'ALL', label: 'Tous', countKey: 'all' },
]

/**
 * Les alertes ne sont PAS exclusives : un paiement peut en porter plusieurs, leurs nombres se
 * recoupent. À afficher près des pastilles ; ne jamais les additionner (`attention` fait foi).
 */
export const PAYMENT_COUNTS_OVERLAP_HINT = 'Les nombres d’« À traiter » et des alertes se recoupent'

/** `label` : libellé complet ; `shortLabel` : étiquette de ligne dans le tableau. */
export const PAYMENT_ALERTS: Record<PaymentAlertCode, { label: string; shortLabel: string; tone: 'danger' | 'warning' }> = {
  HELD: { label: 'Versement retenu', shortLabel: 'Retenu', tone: 'danger' },
  CHARGEBACK_OPEN: { label: 'Litige bancaire ouvert', shortLabel: 'Litige bancaire', tone: 'danger' },
  MM_FAILED: { label: 'Versement échoué', shortLabel: 'Versement échoué', tone: 'danger' },
  ESCROW_J48: { label: 'En séquestre depuis plus de 48 h', shortLabel: 'Séquestre > 48 h', tone: 'warning' },
}

export function paymentAlertMeta(code?: string | null) {
  return code && Object.hasOwn(PAYMENT_ALERTS, code) ? PAYMENT_ALERTS[code as PaymentAlertCode] : null
}

/**
 * Paramètres d'URL qui indiquent une recherche précise : la vue par défaut devient « Tous ».
 * `held` (ancien lien « versements retenus ») en est un.
 */
const FILTER_KEYS = ['view', 'alert', 'status', 'method', 'currency', 'dateFrom', 'dateTo', 'hideAbandoned', 'query',
  'partyId', 'announcementId', 'bidId', 'amountMin', 'amountMax', 'held']

export function defaultPaymentViewFor(query: Record<string, unknown>): PaymentView {
  return FILTER_KEYS.some(k => query[k] != null && query[k] !== '') ? 'ALL' : 'ATTENTION'
}
