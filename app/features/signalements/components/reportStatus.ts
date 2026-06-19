import type { ReportStatus } from '@/features/signalements/types/index'

export function reportStatusMeta(s: ReportStatus): { label: string; tone: 'neutral' | 'success' | 'warning' } {
  switch (s) {
    case 'OPEN': return { label: 'Ouvert', tone: 'warning' }
    case 'RESOLVED': return { label: 'Résolu', tone: 'success' }
    case 'DISMISSED': return { label: 'Rejeté', tone: 'neutral' }
  }
}
