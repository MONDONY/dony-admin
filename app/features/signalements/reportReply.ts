import type { AdminReport } from '@/features/signalements/types/index'
import type { AdminPermission } from '@/stores/auth'

/** Borne du back (message de réponse au signalant) : 1 à 4000 caractères. */
export const REPORT_REPLY_MAX = 4000

/**
 * Bouton « Répondre » : `canReply` du back fait foi. Sur un ancien back (champ absent), on
 * le propose pour un rapport de bug (cible APP) si l'admin gère le support. Jamais sur un
 * signalement supprimé.
 */
export function canReplyToReport(r: AdminReport, permissions: Set<AdminPermission>): boolean {
  if (r.deletedAt) return false
  if (typeof r.canReply === 'boolean') return r.canReply
  return r.targetType === 'APP' && permissions.has('SUPPORT_TICKET_MANAGE')
}

/** Une conversation support existe déjà avec le signalant. */
export function hasSupportConversation(r: AdminReport): boolean {
  return typeof r.supportTicketId === 'string' && r.supportTicketId.length > 0
}

export function supportConversationLink(ticketId: string): string {
  return `/support?ticket=${encodeURIComponent(ticketId)}`
}

/** Lien profond vers la page Signalements, ce rapport ouvert en tête. */
export function reportLink(reportId: string): string {
  return `/signalements?open=${encodeURIComponent(reportId)}`
}

/** Prénom affiché dans le bandeau de succès ; « Le signalant » sans nom connu. */
export function reporterFirstName(name?: string | null, fallback?: string | null): string {
  for (const candidate of [name, fallback]) {
    const first = candidate?.trim().split(/\s+/)[0]
    if (first) return first
  }
  return 'Le signalant'
}

/**
 * Bandeau de succès. Le back rend `created` : nouvelle conversation (201) ou réponse ajoutée
 * à la conversation déjà ouverte avec le signalant (200).
 */
export function replySentMessage(firstName: string, created = true): string {
  const head = created ? 'Réponse envoyée, conversation créée.' : 'Réponse ajoutée à la conversation.'
  return `${head} ${firstName} la verra dans Yadony Support.`
}
