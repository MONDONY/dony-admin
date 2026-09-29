import type { SupportCategory, SupportTicketStatus } from '@/features/support/types/index'

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

/** Libellés FR des catégories, dans l'ordre de l'enum backend (« Autre » en dernier). */
export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  ACCOUNT: 'Compte',
  KYC: 'Vérification d’identité',
  PAYMENT: 'Paiement',
  TRIP: 'Trajet',
  PACKAGE: 'Colis',
  DELIVERY: 'Livraison',
  OTHER: 'Autre',
}

/** Libellé FR d'une catégorie ; une valeur inconnue (ancienne donnée) s'affiche telle quelle. */
export function categoryLabel(code: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[code] ?? code
}

/**
 * Bornes du back (AdminStartSupportTicketRequest) : sujet 1 à 200 caractères, message 0 à
 * 4000, avec du texte OU au moins une image. Les dépasser vaudrait un 422 après coup.
 */
export const SUPPORT_SUBJECT_MAX = 200
export const SUPPORT_MESSAGE_MAX = 4000
