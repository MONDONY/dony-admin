import type { BidStatus } from '@/features/bids/types/index'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const MAP: Record<BidStatus, { label: string; tone: Tone }> = {
  AWAITING_PAYMENT: { label: 'Attente paiement', tone: 'neutral' },
  PENDING: { label: 'En attente', tone: 'neutral' },
  PAYMENT_ESCROWED: { label: 'Payé (escrow)', tone: 'info' },
  ACCEPTED: { label: 'Accepté', tone: 'info' },
  HANDED_OVER: { label: 'Remis', tone: 'info' },
  IN_TRANSIT: { label: 'En transit', tone: 'info' },
  REJECTED: { label: 'Refusé', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
  COMPLETED: { label: 'Livré', tone: 'success' },
  NO_SHOW: { label: 'No-show', tone: 'warning' },
  PARCEL_REFUSED: { label: 'Colis refusé', tone: 'warning' },
  EXPIRED: { label: 'Expiré', tone: 'neutral' },
}

export function bidStatusMeta(s: BidStatus): { label: string; tone: Tone } {
  return MAP[s]
}
