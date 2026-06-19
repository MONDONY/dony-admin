import type { DisputeStatus } from '@/features/incidents/types/index'

export function disputeStatusMeta(s: DisputeStatus): { label: string; tone: 'warning' | 'success' } {
  return s === 'OPEN' ? { label: 'Ouvert', tone: 'warning' } : { label: 'Résolu', tone: 'success' }
}
