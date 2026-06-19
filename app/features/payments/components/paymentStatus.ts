import type { PaymentStatus } from '@/features/payments/types/index'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const MAP: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'En attente', tone: 'neutral' },
  ESCROW: { label: 'Sous séquestre', tone: 'info' },
  RELEASED: { label: 'Libéré', tone: 'success' },
  FAILED: { label: 'Échoué', tone: 'danger' },
  REFUNDED: { label: 'Remboursé', tone: 'warning' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
}

export function paymentStatusMeta(s: PaymentStatus): { label: string; tone: Tone } {
  return MAP[s]
}
