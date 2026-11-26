import type { AdminSupportTicket } from '@/features/support/types/index'
import { parseServerDate } from '@/lib/serverDate'

export type SupportChip = 'OPEN' | 'RESOLVED'

export const SUPPORT_CHIPS: readonly { key: SupportChip; label: string }[] = [
  { key: 'OPEN', label: 'Ouverts' },
  { key: 'RESOLVED', label: 'Résolus' },
]

/** Même borne que le poste ordinateur (corps de réponse du back : 4000 caractères). */
export const MOBILE_REPLY_MAX = 4000

/** Prénom court pour la liste : le premier mot du nom affiché. */
export function shortName(displayName: string | null | undefined): string {
  return (displayName ?? '').trim().split(/\s+/)[0] || 'Utilisateur'
}

const lastMs = (t: AdminSupportTicket) => {
  const v = parseServerDate(t.lastMessageAt)
  return Number.isNaN(v) ? 0 : v
}

/** Dernier message en premier. */
export function sortNewestFirst(tickets: readonly AdminSupportTicket[]): AdminSupportTicket[] {
  return [...tickets].sort((a, b) => lastMs(b) - lastMs(a))
}

/** « Ouverts » = tout sauf résolu : l'API n'a qu'un filtre par statut, le reste se fait ici. */
export function filterForChip(tickets: readonly AdminSupportTicket[], chip: SupportChip): AdminSupportTicket[] {
  return tickets.filter(t => (chip === 'RESOLVED' ? t.status === 'RESOLVED' : t.status !== 'RESOLVED'))
}

/** Pastille « à répondre » : le dernier mot est à l'utilisateur et le billet est ouvert. */
export function needsAnswer(t: AdminSupportTicket): boolean {
  return t.status !== 'RESOLVED' && t.lastMessageAuthor === 'USER'
}

/** Texte d'envoi prêt à partir, ou la raison du refus. */
export function checkReply(raw: string): { ok: true; text: string } | { ok: false; error: string } {
  const text = raw.trim()
  if (!text) return { ok: false, error: 'Écrivez un message avant d’envoyer' }
  if (text.length > MOBILE_REPLY_MAX) return { ok: false, error: `Message trop long (${MOBILE_REPLY_MAX} caractères au maximum)` }
  return { ok: true, text }
}
