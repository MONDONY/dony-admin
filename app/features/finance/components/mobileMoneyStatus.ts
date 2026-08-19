import type { MobileMoneyPaymentStatus } from '@/features/finance/types/index'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const MAP: Record<MobileMoneyPaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'En attente', tone: 'warning' },
  COMPLETED: { label: 'Terminé', tone: 'success' },
  FAILED: { label: 'Échoué', tone: 'danger' },
  EXPIRED: { label: 'Expiré', tone: 'neutral' },
}

export function mobileMoneyStatusMeta(s: MobileMoneyPaymentStatus): { label: string; tone: Tone } {
  return MAP[s]
}
