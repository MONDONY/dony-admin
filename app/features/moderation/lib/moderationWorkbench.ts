import type { AdminConversation, AdminMessage, ConversationHistoryEntry } from '@/features/moderation/types/index'
import type { TimelineItem } from '@/features/signalements/reportContext'
import type { AdminReport } from '@/features/signalements/types/index'
import { parseServerDate, serverDateIso } from '@/lib/serverDate'

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** Un signalement ouvert depuis 12 h est à surveiller, depuis 2 jours il est en retard. */
const WATCH_AFTER = 12 * HOUR
const LATE_AFTER = 2 * DAY

/** Un signalement ouvert sur un message de la conversation. */
export interface OpenReport {
  id: string
  reason: string
  reporterName: string | null
  createdAt: string
}

/** Une ligne de la file : une conversation et les signalements ouverts qui la visent. */
export interface QueueConversation {
  /** Identifiant Firestore : celui des appels de lecture et de suppression. */
  id: string
  /** Identifiant interne : celui que porte `targetId` d'un signalement de message. Null sur un ancien back. */
  conversationId: string | null
  participantA: string | null
  participantB: string | null
  participantAId: string | null
  participantBId: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  createdAt: string | null
  closedAt: string | null
  /** Détail des signalements ouverts (motif, signalant, date) : lu avec REPORT_VIEW, sinon vide. */
  reports: OpenReport[]
  /** Nombre de signalements ouverts que le serveur compte ; vaut au moins `reports.length`. */
  openReportCount: number
  /** Conversation ouverte par un lien alors qu'elle n'est pas dans la file : participants inconnus. */
  partial: boolean
}

export type ConversationScope = 'reported' | 'all'
export type QueueGroupKey = 'REPORTED' | 'RECENT'
export interface QueueGroup { key: QueueGroupKey; title: string; items: QueueConversation[] }

export const GROUP_TITLES: Record<QueueGroupKey, string> = {
  REPORTED: 'Signalement ouvert',
  RECENT: 'Activité récente',
}

function ms(iso: string | null | undefined): number {
  const v = parseServerDate(iso)
  return Number.isNaN(v) ? NaN : v
}

function span(elapsed: number): string {
  if (elapsed < HOUR) return '< 1 h'
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h`
  return `${Math.floor(elapsed / DAY)} j`
}

// ---- File ----

/**
 * Fusionne les conversations chargées (la page récente et celle des signalées, déjà dédoublonnées par
 * identifiant) et le détail des signalements ouverts sur un message. Un signalement porte l'identifiant
 * INTERNE de la conversation (`conversationId`), jamais son identifiant Firestore : le rapprochement se
 * fait donc sur lui. Un signalement dont la conversation n'est pas chargée est ignoré ici (le serveur la
 * rend dans la liste des signalées, avec son identifiant Firestore).
 */
export function buildQueue(conversations: readonly AdminConversation[], reports: readonly AdminReport[]): QueueConversation[] {
  const byConversation = new Map<string, OpenReport[]>()
  for (const r of reports) {
    if (r.targetType !== 'MESSAGE' || r.status !== 'OPEN' || !r.targetId) continue
    const list = byConversation.get(r.targetId) ?? []
    list.push({ id: r.id, reason: r.reason, reporterName: r.reporterName ?? null, createdAt: r.createdAt })
    byConversation.set(r.targetId, list)
  }
  return conversations.map((c) => {
    const detail = c.conversationId ? (byConversation.get(c.conversationId) ?? []) : []
    return {
      id: c.id,
      conversationId: c.conversationId ?? null,
      participantA: c.participantA,
      participantB: c.participantB,
      participantAId: c.participantAId ?? null,
      participantBId: c.participantBId ?? null,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview?.trim() || null,
      createdAt: c.createdAt,
      closedAt: c.closedAt ?? null,
      reports: detail,
      openReportCount: Math.max(detail.length, typeof c.openReportCount === 'number' ? c.openReportCount : 0),
      partial: false,
    }
  })
}

/** Réunit deux pages de conversations sans doublon (la page récente d'abord). */
export function mergeConversations(...pages: readonly (readonly AdminConversation[])[]): AdminConversation[] {
  const seen = new Set<string>()
  const out: AdminConversation[] = []
  for (const page of pages) {
    for (const c of page) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
    }
  }
  return out
}

/**
 * Le serveur sait rapprocher les signalements des conversations : il rend `conversationId`. Un ancien back
 * ne le fait pas, et aucune conversation n'y apparaît signalée. Sans conversation, rien à dire.
 */
export function flagsSupported(conversations: readonly AdminConversation[]): boolean {
  return conversations.length === 0 || conversations.some((c) => !!c.conversationId)
}

/** Une conversation qui a au moins un signalement ouvert sur un message. */
export const isReported = (c: Pick<QueueConversation, 'openReportCount'>): boolean => c.openReportCount > 0

const oldestReportAt = (c: QueueConversation): number => Math.min(...c.reports.map((r) => ms(r.createdAt)).filter((v) => !Number.isNaN(v)), Infinity)
const activityAt = (c: QueueConversation): number => {
  const v = ms(c.lastMessageAt ?? c.createdAt)
  return Number.isNaN(v) ? 0 : v
}

/** Texte comparé sans accents ni casse : « Aïcha » se trouve en tapant « aicha ». */
const fold = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export interface QueueFilter { scope: ConversationScope; query: string }

export function filterQueue(items: readonly QueueConversation[], f: QueueFilter): QueueConversation[] {
  const q = fold(f.query.trim())
  return items.filter((c) => {
    if (f.scope === 'reported' && !isReported(c)) return false
    if (!q) return true
    return fold(`${c.participantA ?? ''} ${c.participantB ?? ''}`).includes(q)
  })
}

/** Signalées d'abord (le plus ancien signalement en tête), puis l'activité la plus récente. */
export function groupQueue(items: readonly QueueConversation[]): QueueGroup[] {
  const reported = items.filter(isReported).sort((a, b) => oldestReportAt(a) - oldestReportAt(b) || activityAt(b) - activityAt(a))
  const recent = items.filter((c) => !isReported(c)).sort((a, b) => activityAt(b) - activityAt(a))
  const groups: QueueGroup[] = [
    { key: 'REPORTED', title: GROUP_TITLES.REPORTED, items: reported },
    { key: 'RECENT', title: GROUP_TITLES.RECENT, items: recent },
  ]
  return groups.filter((g) => g.items.length > 0)
}

export const queueOrder = (groups: readonly QueueGroup[]): QueueConversation[] => groups.flatMap((g) => g.items)

export const defaultConversationId = (order: readonly QueueConversation[]): string | null => order[0]?.id ?? null

/** Voisin dans la file (J / K) ; sans sélection, le premier. Reste sur place aux extrémités. */
export function neighbourConversationId(order: readonly QueueConversation[], currentId: string | null, step: 1 | -1): string | null {
  if (order.length === 0) return null
  const from = order.findIndex((c) => c.id === currentId)
  if (from === -1) return order[0]!.id
  return order[Math.min(order.length - 1, Math.max(0, from + step))]!.id
}

export const scopeCounts = (items: readonly QueueConversation[]): Record<ConversationScope, number> => ({
  reported: items.filter(isReported).length,
  all: items.length,
})

// ---- Anciennetés et synthèse ----

/** Depuis quand un signalement attend : neutre, puis à surveiller (12 h), puis en retard (2 j). */
export function reportAge(createdAt: string | null | undefined, now: number = Date.now()): { label: string; tone: 'neutral' | 'warning' | 'danger' } | null {
  const at = ms(createdAt)
  if (Number.isNaN(at)) return null
  const elapsed = Math.max(0, now - at)
  return { label: span(elapsed), tone: elapsed >= LATE_AFTER ? 'danger' : elapsed >= WATCH_AFTER ? 'warning' : 'neutral' }
}

/** Le signalement le plus ancien d'une conversation. */
export function oldestReport(c: Pick<QueueConversation, 'reports'>): OpenReport | null {
  let best: OpenReport | null = null
  for (const r of c.reports) {
    if (!best || ms(r.createdAt) < ms(best.createdAt)) best = r
  }
  return best
}

export interface QueueSummary {
  /** Conversations avec au moins un signalement ouvert. */
  reportedConversations: number
  openReports: number
  oldest: { label: string; reporter: string | null; participants: string } | null
}

export function summarizeQueue(items: readonly QueueConversation[], now: number = Date.now()): QueueSummary {
  const reported = items.filter(isReported)
  let oldest: QueueSummary['oldest'] = null
  let oldestAt = Infinity
  for (const c of reported) {
    const r = oldestReport(c)
    const at = r ? ms(r.createdAt) : NaN
    if (r && !Number.isNaN(at) && at < oldestAt) {
      oldestAt = at
      oldest = { label: reportAge(r.createdAt, now)!.label, reporter: r.reporterName, participants: participantsLabel(c) }
    }
  }
  return {
    reportedConversations: reported.length,
    openReports: reported.reduce((n, c) => n + c.openReportCount, 0),
    oldest,
  }
}

/** « Aïcha ↔ Moussa » ; un participant inconnu s'écrit « — ». */
export function participantsLabel(c: Pick<QueueConversation, 'participantA' | 'participantB' | 'partial'>): string {
  if (c.partial) return c.participantA ?? 'Conversation signalée'
  return `${c.participantA ?? '—'} ↔ ${c.participantB ?? '—'}`
}

// ---- Fil ----

export const isMessageDeleted = (m: Pick<AdminMessage, 'deleted' | 'deletedAt'>): boolean => m.deleted || !!m.deletedAt

/** Message de la plateforme (rappel, annonce de remise) : centré, sans bulle de participant. */
export const isSystemMessage = (m: Pick<AdminMessage, 'type' | 'senderName'>): boolean => m.type === 'SYSTEM' || m.senderName === 'Systeme'

/** La bulle d'un message passe à droite quand son auteur est le second participant de la conversation. */
export const isRightSide = (m: Pick<AdminMessage, 'senderName'>, c: Pick<QueueConversation, 'participantB'> | null): boolean =>
  !!c && !!m.senderName && m.senderName === c.participantB

/** Le message signalé de la conversation, tel que le contexte du signalement le désigne. */
export function flaggedMessageId(messages: readonly { id: string; flagged: boolean }[] | null | undefined): string | null {
  return messages?.find((m) => m.flagged)?.id ?? null
}

// ---- Historique ----

const AUDIT_LABELS: Record<string, string> = {
  MESSAGE_ADMIN_DELETED: 'Message supprimé',
  MESSAGE_ADMIN_RESTORED: 'Message rétabli',
  CONVERSATION_NOTE_ADDED: 'Note ajoutée',
}

/** Gestes de modération de la conversation, du plus ancien au plus récent (le back les rend du plus récent au plus ancien). */
export function conversationTimeline(history: readonly ConversationHistoryEntry[] | null | undefined): TimelineItem[] {
  return [...(history ?? [])].reverse().map((e, n): TimelineItem => ({
    key: `${e.action}-${n}`,
    label: AUDIT_LABELS[e.action] ?? e.action,
    at: e.at ? serverDateIso(e.at) : null,
    by: e.actorEmail ? `par ${e.actorEmail}` : null,
    note: e.note ?? null,
  }))
}
