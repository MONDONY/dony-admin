import type { AlertSeverity } from '@/features/alerts/types/index'

export function alertSeverityMeta(s: AlertSeverity): { label: string; tone: 'info' | 'warning' | 'danger' } {
  switch (s) {
    case 'INFO': return { label: 'Info', tone: 'info' }
    case 'WARN': return { label: 'Attention', tone: 'warning' }
    case 'CRITICAL': return { label: 'Critique', tone: 'danger' }
  }
}
