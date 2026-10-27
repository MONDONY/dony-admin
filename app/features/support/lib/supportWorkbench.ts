import type { AdminSupportTicket, SupportHistoryEntry, SupportMessage, SupportPriority, SupportTicketScope } from '@/features/support/types/index'
import { categoryLabel } from '@/features/support/utils/format'
import type { TimelineItem } from '@/features/signalements/reportContext'
import { parseServerDate, serverDateIso } from '@/lib/serverDate'

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** Une conversation qui attend le support depuis 12 h est à surveiller, depuis 2 jours elle est en retard. */
const WATCH_AFTER = 12 * HOUR
const LATE_AFTER = 2 * DAY

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

/** À répondre : le support doit agir ; En attente : la balle est chez l'utilisateur ; Résolus : terminé. */
export type TicketGroupKey = 'TO_ANSWER' | 'WAITING_USER' | 'RESOLVED'
export const GROUP_TITLES: Record<TicketGroupKey, string> = {
  TO_ANSWER: 'À répondre',
  WAITING_USER: 'En attente de l’utilisateur',
  RESOLVED: 'Résolus',
}
const GROUP_ORDER: TicketGroupKey[] = ['TO_ANSWER', 'WAITING_USER', 'RESOLVED']

export function ticketGroupOf(t: Pick<AdminSupportTicket, 'status'>): TicketGroupKey {
  if (t.status === 'RESOLVED') return 'RESOLVED'
  return t.status === 'WAITING_USER' ? 'WAITING_USER' : 'TO_ANSWER'
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

/**
 * Temps écoulé depuis le dernier message d'un ticket ouvert. À répondre : en alerte (12 h, puis 2 jours).
 * En attente de l'utilisateur : neutre, c'est à lui de répondre. Null pour un ticket résolu.
 */
export function waitingAge(t: Pick<AdminSupportTicket, 'status' | 'lastMessageAt'>, now: number = Date.now()): { label: string; tone: 'neutral' | 'warning' | 'danger' } | null {
  const group = ticketGroupOf(t)
  if (group === 'RESOLVED') return null
  const last = ms(t.lastMessageAt)
  const elapsed = Number.isNaN(last) ? 0 : Math.max(0, now - last)
  if (group === 'WAITING_USER') return { label: span(elapsed), tone: 'neutral' }
  return { label: span(elapsed), tone: elapsed >= LATE_AFTER ? 'danger' : elapsed >= WATCH_AFTER ? 'warning' : 'neutral' }
}

const PRIORITY: Record<string, { label: string; tone: Tone; rank: number }> = {
  LOW: { label: 'Priorité basse', tone: 'neutral', rank: 0 },
  NORMAL: { label: 'Priorité normale', tone: 'neutral', rank: 1 },
  HIGH: { label: 'Priorité haute', tone: 'warning', rank: 2 },
  URGENT: { label: 'Urgent', tone: 'danger', rank: 3 },
}
const priorityRank = (p: string): number => PRIORITY[p]?.rank ?? 1

/** Seules les priorités qui sortent de l'ordinaire se signalent : « normale » ne dit rien. */
export function priorityMeta(priority: string): { label: string; tone: Tone } | null {
  if (priority === 'NORMAL' || !PRIORITY[priority]) return null
  return { label: PRIORITY[priority]!.label, tone: PRIORITY[priority]!.tone }
}

/** Priorités proposées à l'agent, de la plus pressante à la moins pressante. */
export const PRIORITY_CHOICES: { value: SupportPriority; label: string }[] = [
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'Haute' },
  { value: 'NORMAL', label: 'Normale' },
  { value: 'LOW', label: 'Basse' },
]

export const isHighPriority = (t: Pick<AdminSupportTicket, 'priority'>): boolean => priorityRank(t.priority) >= 2

/** « user D : Bonjour, mon colis… » : l'aperçu du dernier message avec son auteur ; null sans aperçu (ancien back, fil vide). */
export function previewLine(t: Pick<AdminSupportTicket, 'lastMessagePreview' | 'lastMessageAuthor' | 'userDisplayName'>): string | null {
  const text = t.lastMessagePreview?.trim()
  if (!text) return null
  return `${t.lastMessageAuthor === 'ADMIN' ? 'Support' : t.userDisplayName} : ${text}`
}

// ---- File ----

export interface TicketGroup {
  key: TicketGroupKey
  title: string
  tickets: AdminSupportTicket[]
}

/**
 * Groupes de la file. À répondre : priorité haute d'abord, puis le plus ancien (celui qui attend depuis
 * le plus longtemps). Les autres : le plus récent d'abord. Un groupe vide n'existe pas.
 */
export function groupTickets(tickets: readonly AdminSupportTicket[]): TicketGroup[] {
  const byGroup = new Map<TicketGroupKey, AdminSupportTicket[]>()
  for (const t of tickets) {
    const key = ticketGroupOf(t)
    byGroup.set(key, [...(byGroup.get(key) ?? []), t])
  }
  return GROUP_ORDER.filter((k) => byGroup.has(k)).map((key) => {
    const list = [...byGroup.get(key)!]
    if (key === 'TO_ANSWER') {
      list.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || (ms(a.lastMessageAt) || 0) - (ms(b.lastMessageAt) || 0))
    } else {
      list.sort((a, b) => (ms(b.lastMessageAt) || 0) - (ms(a.lastMessageAt) || 0))
    }
    return { key, title: GROUP_TITLES[key], tickets: list }
  })
}

/** Tickets dans l'ordre d'affichage : ce que J et K parcourent. */
export const queueOrder = (groups: readonly TicketGroup[]): AdminSupportTicket[] => groups.flatMap((g) => g.tickets)

export interface TicketFilter {
  scope: SupportTicketScope
  query: string
  category: string | null
  highPriorityOnly: boolean
  /** Compte de l'admin connecté : « Mes tickets ». */
  myId: string | null
}

/**
 * Périmètre (non assignés encore ouverts, les miens, tous), recherche libre (sujet, nom, catégorie) et
 * filtres de catégorie et de priorité.
 */
export function filterTickets(tickets: readonly AdminSupportTicket[], f: TicketFilter): AdminSupportTicket[] {
  const q = f.query.trim().toLowerCase()
  return tickets.filter((t) => {
    if (f.scope === 'unassigned' && (t.assignedAdminId !== null || t.status === 'RESOLVED')) return false
    if (f.scope === 'mine' && (!f.myId || t.assignedAdminId !== f.myId)) return false
    if (f.category && t.category !== f.category) return false
    if (f.highPriorityOnly && !isHighPriority(t)) return false
    if (!q) return true
    return `${t.subject} ${t.userDisplayName} ${categoryLabel(t.category)}`.toLowerCase().includes(q)
  })
}

/** Nombre de tickets de chaque onglet, pour les pastilles. */
export function scopeCounts(tickets: readonly AdminSupportTicket[], myId: string | null): Record<SupportTicketScope, number> {
  return {
    unassigned: tickets.filter((t) => t.assignedAdminId === null && t.status !== 'RESOLVED').length,
    mine: myId ? tickets.filter((t) => t.assignedAdminId === myId).length : 0,
    all: tickets.length,
  }
}

/** Catégories présentes, dans l'ordre de première apparition. */
export const ticketCategories = (tickets: readonly AdminSupportTicket[]): string[] => [...new Set(tickets.map((t) => t.category))]

export interface SupportSummary {
  toAnswer: number
  unassigned: number
  /** Le ticket à répondre qui attend depuis le plus longtemps. */
  oldest: { label: string; subject: string } | null
  resolvedThisWeek: number
}

export function summarizeTickets(tickets: readonly AdminSupportTicket[], now: number = Date.now()): SupportSummary {
  const toAnswer = tickets.filter((t) => ticketGroupOf(t) === 'TO_ANSWER')
  const oldest = [...toAnswer].sort((a, b) => (ms(a.lastMessageAt) || Infinity) - (ms(b.lastMessageAt) || Infinity))[0]
  return {
    toAnswer: toAnswer.length,
    unassigned: tickets.filter((t) => t.assignedAdminId === null && t.status !== 'RESOLVED').length,
    oldest: oldest ? { label: waitingAge(oldest, now)!.label, subject: oldest.subject } : null,
    resolvedThisWeek: tickets.filter((t) => {
      const at = ms(t.resolvedAt)
      return !Number.isNaN(at) && now - at <= 7 * DAY
    }).length,
  }
}

// ---- Sélection ----

export const defaultTicketId = (order: readonly AdminSupportTicket[]): string | null => order[0]?.id ?? null

/** Voisin dans la file (J / K) ; sans sélection, le premier. Reste sur place aux extrémités. */
export function neighbourTicketId(order: readonly AdminSupportTicket[], currentId: string | null, step: 1 | -1): string | null {
  if (order.length === 0) return null
  const from = order.findIndex((t) => t.id === currentId)
  if (from === -1) return order[0]!.id
  return order[Math.min(order.length - 1, Math.max(0, from + step))]!.id
}

// ---- Conversation ----

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
const dayYearFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

export interface MessageDay<T extends { createdAt: string } = SupportMessage> { key: string; label: string; messages: T[] }

/** Messages regroupés par jour (heure de Paris), du plus ancien au plus récent ; l'année s'ajoute hors de l'année en cours. */
export function groupMessagesByDay<T extends { createdAt: string }>(messages: readonly T[], now: number = Date.now()): MessageDay<T>[] {
  const days: MessageDay<T>[] = []
  const parisDay = (at: number) => new Date(at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
  const thisYear = parisDay(now).slice(0, 4)
  for (const m of messages) {
    const at = ms(m.createdAt)
    const key = Number.isNaN(at) ? 'inconnu' : parisDay(at)
    const last = days[days.length - 1]
    if (last && last.key === key) { last.messages.push(m); continue }
    const label = Number.isNaN(at) ? 'Date inconnue' : (key.slice(0, 4) === thisYear ? dayFormat : dayYearFormat).format(at)
    days.push({ key, label, messages: [m] })
  }
  return days
}

/** « 15:19 » (heure de Paris), chaîne vide si la date est illisible. */
export function messageTime(iso: string): string {
  const at = ms(iso)
  return Number.isNaN(at) ? '' : timeFormat.format(at)
}

/** « Sans réponse depuis 8 j » : seulement quand le support doit agir et que ça traîne depuis plus d'un jour. */
export function silenceNote(t: Pick<AdminSupportTicket, 'status' | 'lastMessageAt'>, now: number = Date.now()): string | null {
  if (ticketGroupOf(t) !== 'TO_ANSWER') return null
  const last = ms(t.lastMessageAt)
  if (Number.isNaN(last) || now - last < DAY) return null
  return `Sans réponse depuis ${span(now - last)}`
}

// ---- Réponse ----

export interface QuickReply { label: string; text: string }

/** Réponses types, une liste fixe de l'app (le lot suivant les gérera côté serveur). */
export const QUICK_REPLIES: QuickReply[] = [
  { label: 'Demande de précisions', text: 'Bonjour, pouvez-vous nous donner plus de détails (numéro de colis, date, capture d’écran si possible) afin que nous puissions vous aider ?' },
  { label: 'Suivi du colis', text: 'Bonjour, nous vérifions le suivi de votre colis auprès du voyageur et nous revenons vers vous dès que nous avons une réponse.' },
  { label: 'Vérification d’identité', text: 'Bonjour, pour vérifier votre identité, ouvrez l’application et suivez les étapes de la section « Vérification d’identité » de votre profil. Dites-nous si une étape vous bloque.' },
  { label: 'Pris en charge', text: 'Bonjour, nous avons bien reçu votre demande et nous nous en occupons.' },
  { label: 'Clôture', text: 'Bonjour, votre demande est traitée. Si besoin, vous pouvez nous écrire à nouveau depuis l’application. Bonne journée.' },
]

/** Ajoute une réponse type au brouillon, après une ligne vide s'il y a déjà du texte. */
export function insertQuickReply(draft: string, text: string): string {
  const current = draft.trimEnd()
  return current ? `${current}\n\n${text}` : text
}

export const REPLY_MAX = 4000

// ---- Historique ----

const AUDIT_LABELS: Record<string, string> = {
  SUPPORT_TICKET_ASSIGNED: 'Ticket assigné',
  SUPPORT_TICKET_REASSIGNED: 'Ticket repris',
  SUPPORT_TICKET_ADMIN_REPLIED: 'Réponse envoyée',
  SUPPORT_TICKET_ADMIN_ATTACHED: 'Image jointe',
  SUPPORT_TICKET_ADMIN_STARTED: 'Conversation ouverte par le support',
  SUPPORT_TICKET_NOTE_ADDED: 'Note interne ajoutée',
  SUPPORT_TICKET_RESOLVED: 'Ticket résolu',
  SUPPORT_TICKET_HIDDEN_BY_USER: 'Masqué par l’utilisateur',
}
const PRIORITY_NAMES: Record<string, string> = { URGENT: 'urgente', HIGH: 'haute', NORMAL: 'normale', LOW: 'basse' }

function auditLabel(e: SupportHistoryEntry): string {
  if (e.action === 'SUPPORT_TICKET_PRIORITY_CHANGED') return `Priorité ${PRIORITY_NAMES[e.detail ?? ''] ?? 'modifiée'}`
  return AUDIT_LABELS[e.action] ?? e.action
}

/**
 * Chronologie d'un ticket, de la plus ancienne à la plus récente. Avec le contexte, chaque geste tracé dans
 * l'audit (le back les rend du plus récent au plus ancien) ; sans lui (ancien back), ce que le ticket porte
 * seul : ouverture, assignation sans date, résolution. La création tracée par le back se fond dans l'ouverture.
 */
export function ticketTimeline(
  t: Pick<AdminSupportTicket, 'id' | 'createdAt' | 'assignedAdminEmail' | 'resolvedAt'>,
  history?: readonly SupportHistoryEntry[] | null,
): TimelineItem[] {
  const opened: TimelineItem = { key: `opened-${t.id}`, label: 'Ticket ouvert', at: serverDateIso(t.createdAt), by: null, note: null }
  if (history) {
    const steps = [...history].filter((e) => e.action !== 'SUPPORT_TICKET_CREATED').reverse().map((e, n): TimelineItem => ({
      key: `${e.action}-${n}`, label: auditLabel(e), at: e.at ? serverDateIso(e.at) : null,
      by: e.actorEmail ? `par ${e.actorEmail}` : null, note: e.note ?? null,
    }))
    return [opened, ...steps]
  }
  const items = [opened]
  if (t.assignedAdminEmail) items.push({ key: `assigned-${t.id}`, label: `Assigné à ${t.assignedAdminEmail}`, at: null, by: null, note: null })
  if (t.resolvedAt) items.push({ key: `resolved-${t.id}`, label: 'Résolu', at: serverDateIso(t.resolvedAt), by: null, note: null })
  return items
}

// ---- Notes et réponses types ----

export const NOTE_MIN = 3
export const NOTE_MAX = 1000
export const TEMPLATE_LABEL_MAX = 60
export const TEMPLATE_CONTENT_MAX = 4000

export function noteError(note: string): string | null {
  const n = note.trim().length
  if (n < NOTE_MIN) return `Écrivez ce qu'il faut savoir (${NOTE_MIN} caractères au moins).`
  if (n > NOTE_MAX) return `Note trop longue (${NOTE_MAX} caractères au plus).`
  return null
}

/** Le libellé et le texte d'une réponse type : tous deux obligatoires, dans les bornes du back. */
export function templateError(label: string, content: string): string | null {
  if (!label.trim() || !content.trim()) return 'Le libellé et le texte sont obligatoires.'
  if (label.trim().length > TEMPLATE_LABEL_MAX) return `Libellé trop long (${TEMPLATE_LABEL_MAX} caractères au plus).`
  if (content.trim().length > TEMPLATE_CONTENT_MAX) return `Texte trop long (${TEMPLATE_CONTENT_MAX} caractères au plus).`
  return null
}
