import type { ChargebackCounts, ChargebackView } from '@/features/payments/types/index'
import type { FinanceViewDef } from './financeViews'

/** Vues des litiges bancaires : les ouverts appellent une réponse, les autres sont l'historique. */
export const CHARGEBACK_VIEWS: FinanceViewDef<ChargebackView>[] = [
  { id: 'OPEN', label: 'Ouverts', countKey: 'open', alert: true },
  { id: 'WON', label: 'Gagnés', countKey: 'won' },
  { id: 'LOST', label: 'Perdus', countKey: 'lost' },
  { id: 'ALL', label: 'Tous', countKey: 'all' },
]

/** Vue d'ouverture : les ouverts s'il y en a ; sans nombres (ancien back) : tous. */
export function defaultChargebackView(counts: ChargebackCounts | null): ChargebackView {
  return counts && counts.open > 0 ? 'OPEN' : 'ALL'
}

export function isChargebackCounts(v: unknown): v is ChargebackCounts {
  const c = v as Partial<Record<keyof ChargebackCounts, unknown>> | null
  return !!c && (['open', 'won', 'lost', 'all'] as const).every(k => typeof c[k] === 'number')
}

/** Motifs Stripe (`dispute.reason`) en clair ; un motif inconnu reste affiché tel quel. */
const REASONS: Record<string, string> = {
  fraudulent: 'Fraude présumée',
  product_not_received: 'Colis non reçu',
  product_unacceptable: 'Colis non conforme',
  duplicate: 'Paiement en double',
  unrecognized: 'Paiement non reconnu',
  credit_not_processed: 'Remboursement non traité',
  subscription_canceled: 'Abonnement annulé',
  general: 'Motif général',
}
export function chargebackReasonLabel(reason: string | null | undefined): string | null {
  return reason ? REASONS[reason] ?? reason : null
}

/** Issue du litige, seulement quand elle ajoute quelque chose au statut (« won » sous « Gagné » : rien). */
export function chargebackOutcomeLabel(status: string, outcome: string | null | undefined): string | null {
  if (!outcome || outcome.toUpperCase() === status) return null
  return outcome
}
