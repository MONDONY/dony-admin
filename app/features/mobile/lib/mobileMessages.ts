import type { AdminConversation, AdminMessage, ConversationLinkedReport } from '@/features/moderation/types/index'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import { parseServerDate } from '@/lib/serverDate'
import { firestoreIdParam, safeHttpsUrl } from '@/lib/safeInput'

export type MessagesChip = 'FLAGGED' | 'ALL'

export const MESSAGES_CHIPS: readonly { key: MessagesChip; label: string }[] = [
  { key: 'FLAGGED', label: 'Signalées' },
  { key: 'ALL', label: 'Toutes' },
]

export const MESSAGES_PAGE_SIZE = 20
export const MESSAGES_SEARCH_MIN = 2
export const MESSAGES_SEARCH_DELAY_MS = 300
const RECENT_MS = 7 * 24 * 3600 * 1000

/** « Aïcha Traoré » devient « Aïcha T. » ; un nom vide devient « Utilisateur ». */
export function shortParticipant(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Utilisateur'
  const first = parts[0]!
  const last = parts.length > 1 ? parts[parts.length - 1]! : ''
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first
}

export function pairLabel(a: string | null | undefined, b: string | null | undefined): string {
  return `${shortParticipant(a)} et ${shortParticipant(b)}`
}

export function isFlaggedConversation(c: Pick<AdminConversation, 'flagged' | 'openReportCount'>): boolean {
  return (c.openReportCount ?? 0) > 0 || c.flagged === true
}

export type Severity = 'danger' | 'warning' | 'neutral'

/** Rouge : signalée ; orange : active dans la semaine ; gris : ancienne. */
export function conversationSeverity(c: AdminConversation, now: number = Date.now()): Severity {
  if (isFlaggedConversation(c)) return 'danger'
  const t = parseServerDate(c.lastMessageAt)
  return !Number.isNaN(t) && now - t < RECENT_MS ? 'warning' : 'neutral'
}

export function reportCountLabel(c: Pick<AdminConversation, 'flagged' | 'openReportCount'>): string | null {
  const n = c.openReportCount ?? 0
  if (n > 0) return n === 1 ? '1 signalement' : `${n} signalements`
  return c.flagged ? 'Signalée' : null
}

export function messageCountLabel(n: number): string {
  return n === 1 ? '1 message' : `${n} messages`
}

/** Recherche prête à partir : rognée, 2 caractères au moins, sinon aucune. */
export function effectiveQuery(raw: string): string | undefined {
  const q = raw.trim()
  return q.length >= MESSAGES_SEARCH_MIN ? q : undefined
}

/** Identifiant Firestore de la conversation, seulement s'il a une forme sûre pour une URL. */
export function threadRoute(c: Pick<AdminConversation, 'id'>): string | null {
  const id = firestoreIdParam(c.id)
  return id ? `/m/messages/${id}` : null
}

export interface BubbleImage { thumb: string; full: string }

export interface Bubble {
  id: string
  sender: string
  createdAt: string
  deleted: boolean
  content: string
  flagged: boolean
  image: BubbleImage | null
}

/** Motifs des signalements du fil, sans doublon : affichés une fois en tête, jamais sur un message précis. */
export function reportReasons(reports: readonly ConversationLinkedReport[] | null | undefined): string[] {
  const out = new Set<string>()
  for (const r of reports ?? []) out.add(r.reason ? reportReasonLabel(r.reason) : 'Motif non précisé')
  return [...out]
}

/** Supprimé par l'utilisateur ou par un admin, quel que soit le champ que le back renseigne. */
export function isDeletedMessage(m: Pick<AdminMessage, 'deleted' | 'deletedAt' | 'deletedByAdmin'>): boolean {
  return m.deleted === true || !!m.deletedAt || m.deletedByAdmin === true
}

function imageOf(m: AdminMessage): BubbleImage | null {
  if (m.type !== 'IMAGE') return null
  const full = safeHttpsUrl(m.imageUrl)
  const thumb = safeHttpsUrl(m.thumbUrl) ?? full
  return full && thumb ? { thumb, full } : null
}

/** Ordre chronologique ; un message supprimé n'expose jamais son contenu ni sa photo. */
export function toBubbles(messages: readonly AdminMessage[]): Bubble[] {
  const ms = (m: AdminMessage) => {
    const t = parseServerDate(m.createdAt)
    return Number.isNaN(t) ? 0 : t
  }
  return messages
    .map((m, i) => ({ m, i }))
    .sort((a, b) => ms(a.m) - ms(b.m) || a.i - b.i)
    .map(({ m }) => {
      const deleted = isDeletedMessage(m)
      return {
        id: m.id,
        sender: shortParticipant(m.senderName),
        createdAt: m.createdAt,
        deleted,
        content: deleted ? '' : (m.content ?? ''),
        flagged: !deleted && m.flagged === true,
        image: deleted ? null : imageOf(m),
      }
    })
}
