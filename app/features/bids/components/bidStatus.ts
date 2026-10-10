import type { BidStatus } from '@/features/bids/types/index'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const MAP: Record<BidStatus, { label: string; tone: Tone }> = {
  AWAITING_PAYMENT: { label: 'Attente paiement', tone: 'neutral' },
  PENDING: { label: 'En attente', tone: 'neutral' },
  PAYMENT_ESCROWED: { label: 'Payé (séquestre)', tone: 'info' },
  ACCEPTED: { label: 'Accepté', tone: 'info' },
  HANDED_OVER: { label: 'Remis', tone: 'info' },
  IN_TRANSIT: { label: 'En transit', tone: 'info' },
  REJECTED: { label: 'Refusé', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
  COMPLETED: { label: 'Livré', tone: 'success' },
  NO_SHOW: { label: 'Absence (no-show)', tone: 'warning' },
  PARCEL_REFUSED: { label: 'Colis refusé', tone: 'warning' },
  EXPIRED: { label: 'Expiré', tone: 'neutral' },
}

/** Statut inconnu du front (ajouté côté back avant) : affiché brut, ton neutre. */
export function bidStatusMeta(s: BidStatus): { label: string; tone: Tone } {
  return MAP[s] ?? { label: String(s), tone: 'neutral' }
}

/** « Où en est-on » : une phrase qui dit ce qui s'est passé et ce qu'on attend. */
const PHRASES: Record<BidStatus, string> = {
  PENDING: 'Demande envoyée au voyageur, en attente de sa réponse.',
  AWAITING_PAYMENT: 'Accepté par le voyageur, en attente du paiement de l’expéditeur.',
  PAYMENT_ESCROWED: 'Payé par l’expéditeur (argent sous séquestre), en attente de la décision du voyageur.',
  ACCEPTED: 'Accepté par le voyageur, en attente de la remise du colis.',
  HANDED_OVER: 'Colis remis au voyageur, en attente du départ.',
  IN_TRANSIT: 'Colis en route avec le voyageur, en attente de la livraison.',
  COMPLETED: 'Colis livré au destinataire.',
  REJECTED: 'Demande refusée par le voyageur.',
  CANCELLED: 'Colis annulé.',
  NO_SHOW: 'Une absence a été signalée au rendez-vous.',
  PARCEL_REFUSED: 'Le voyageur a refusé le colis à la remise.',
  EXPIRED: 'Demande expirée sans réponse du voyageur.',
}

export function bidStatusPhrase(s: BidStatus): string | null {
  return PHRASES[s] ?? null
}
