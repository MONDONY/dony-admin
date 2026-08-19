import type { CashCommissionStatus } from '@/features/finance/types/index'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const MAP: Record<CashCommissionStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'En attente', tone: 'neutral' },
  REQUIRES_3DS: { label: 'Authentification requise', tone: 'warning' },
  CHARGED: { label: 'Prélevée', tone: 'success' },
  FAILED: { label: 'Échouée', tone: 'danger' },
  REFUNDED: { label: 'Remboursée', tone: 'warning' },
  REFUND_FAILED: { label: 'Remboursement échoué', tone: 'danger' },
}

export function cashCommissionStatusMeta(s: CashCommissionStatus): { label: string; tone: Tone } {
  return MAP[s]
}
