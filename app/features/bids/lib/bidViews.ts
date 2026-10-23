import type { AdminBidCounts, BidAlertCode, BidView } from '../types'

/** Vues rapides de la page Colis, dans l'ordre des onglets. */
export const BID_VIEWS: { id: BidView; label: string; countKey: keyof AdminBidCounts }[] = [
  { id: 'TODO', label: 'À traiter', countKey: 'todo' },
  { id: 'ACTIVE', label: 'En cours', countKey: 'active' },
  { id: 'RECENT', label: 'Livrés depuis 3 jours', countKey: 'recent' },
  { id: 'COMPLETED', label: 'Terminés', countKey: 'completed' },
  { id: 'CLOSED', label: 'Annulés / refusés', countKey: 'closed' },
  { id: 'ALL', label: 'Tous', countKey: 'all' },
]

/** `label` : libellé complet ; `shortLabel` : étiquette de ligne dans le tableau. */
export const BID_ALERTS: Record<BidAlertCode, { label: string; shortLabel: string; tone: 'danger' | 'warning' }> = {
  DISPUTE_OPEN: { label: 'Litige ouvert', shortLabel: 'Litige', tone: 'danger' },
  NO_SHOW: { label: 'No-show', shortLabel: 'No-show', tone: 'danger' },
  PAYMENT_PENDING: { label: 'Paiement en attente', shortLabel: 'Paiement', tone: 'warning' },
  LATE: { label: 'En retard', shortLabel: 'Retard', tone: 'warning' },
}

export function alertMeta(code?: string | null) {
  return code && Object.hasOwn(BID_ALERTS, code) ? BID_ALERTS[code as BidAlertCode] : null
}

/** Paramètres d'URL qui indiquent une recherche précise : la vue par défaut devient « Tous ». */
const FILTER_KEYS = ['view', 'status', 'query', 'announcementId', 'dateFrom', 'dateTo', 'paymentMethod', 'content', 'alert', 'scope']

export function defaultViewFor(query: Record<string, unknown>): BidView {
  return FILTER_KEYS.some(k => query[k] != null && query[k] !== '') ? 'ALL' : 'TODO'
}
