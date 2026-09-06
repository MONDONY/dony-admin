import type { SupportTicketStatus } from '@/features/support/types/index'

export const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  NEW: 'Nouveau',
  ASSIGNED: 'Assigné',
  WAITING_USER: 'Attente utilisateur',
  WAITING_SUPPORT: 'Attente support',
  RESOLVED: 'Résolu',
}

export function statusTone(
  status: SupportTicketStatus,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'NEW': return 'danger'
    case 'WAITING_SUPPORT': return 'warning'
    case 'RESOLVED': return 'success'
    default: return 'info'
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
}
