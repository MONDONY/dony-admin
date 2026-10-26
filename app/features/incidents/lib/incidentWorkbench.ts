import { disputeStatusMeta } from '@/features/incidents/components/disputeStatus'
import {
  amountLabel, noShowSentence, noShowStatusMeta, noShowTitle, remainingMeta, tripLabel,
} from '@/features/incidents/components/noShowLabels'
import { NOSHOW_REASON_MIN, NOSHOW_REASON_MAX } from '@/features/incidents/types/index'
import type {
  AdminDisputeListItem, AdminNoShow, DisputeResolution, NoShowDecision,
} from '@/features/incidents/types/index'
import { parseServerDate } from '@/lib/serverDate'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** Un litige ouvert depuis plus de sept jours est en retard ; à deux jours il est à surveiller. */
const LATE_AFTER = 7 * DAY
const WATCH_AFTER = 2 * DAY

export type IncidentKind = 'DISPUTE' | 'NOSHOW'
export type KindFilter = IncidentKind | 'ALL'
/** À traiter : litiges ouverts et déclarations qui attendent une décision. Traité : le reste. */
export type TabFilter = 'TODO' | 'DONE' | 'ALL'

/** Un élément de la file, quelle que soit sa source : un litige ou une déclaration d'absence. */
export interface Incident {
  /** `dispute:<id>` ou `noshow:<id>` : un litige et une absence peuvent partager un identifiant. */
  key: string
  kind: IncidentKind
  id: string
  bidId: string
  createdAt: string
  todo: boolean
  /** Titre du groupe de la file : les incidents de même nature se regroupent. */
  title: string
  dispute: AdminDisputeListItem | null
  noshow: AdminNoShow | null
}

// ---- Libellés ----

const ADMIN_REASON_LABELS: Record<string, string> = {
  PARCEL_DAMAGED: 'Colis abîmé',
  PARCEL_LOST: 'Colis perdu',
  PARCEL_NOT_DELIVERED: 'Colis non remis',
  CONTENT_MISMATCH: 'Contenu différent de la description',
  PAYMENT_DISAGREEMENT: 'Désaccord sur le paiement',
  PARTY_BEHAVIOUR: 'Comportement d’une partie',
  OTHER: 'Autre motif',
}
const DISPUTE_TYPE_LABELS: Record<string, string> = {
  SENDER_NO_SHOW_CONTESTED: 'Absence de l’expéditeur contestée',
  TRAVELER_DELIVERY_NO_SHOW: 'Voyageur absent à la livraison',
  RECIPIENT_NO_SHOW: 'Destinataire absent à la livraison',
}

function humanize(code: string): string {
  const text = code.replace(/_/g, ' ').toLowerCase().trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Litige'
}

/** « TRAVELER_DELIVERY_NO_SHOW » devient « Voyageur absent à la livraison ». */
export function disputeTypeLabel(type: string): string {
  if (DISPUTE_TYPE_LABELS[type]) return DISPUTE_TYPE_LABELS[type]
  if (type.startsWith('ADMIN_')) return ADMIN_REASON_LABELS[type.slice('ADMIN_'.length)] ?? humanize(type.slice('ADMIN_'.length))
  return humanize(type)
}

export const DISPUTE_RESOLUTION_LABELS: Record<DisputeResolution, string> = {
  RESOLVED_FOR_SENDER: 'Tranché pour l’expéditeur',
  RESOLVED_FOR_TRAVELER: 'Tranché pour le voyageur',
  GUARANTEE_PAID: 'Fonds de garantie versé',
  DISMISSED: 'Classé sans suite',
  SPLIT: 'Séquestre partagé',
}
export const disputeResolutionLabel = (r: string | null | undefined): string | null =>
  r ? (DISPUTE_RESOLUTION_LABELS[r as DisputeResolution] ?? humanize(r)) : null

/** Une phrase qui dit pourquoi ce litige existe, pour qu'on n'ait pas à deviner d'après le code du type. */
export function disputeSentence(d: Pick<AdminDisputeListItem, 'type' | 'senderName' | 'travelerName'>): string {
  if (d.type === 'SENDER_NO_SHOW_CONTESTED') return 'L’expéditeur conteste l’absence que le voyageur lui reproche à la remise du colis.'
  if (d.type === 'TRAVELER_DELIVERY_NO_SHOW' || d.type === 'RECIPIENT_NO_SHOW') return 'Litige ouvert à la suite d’une absence signalée à la livraison du colis.'
  return `${d.senderName ?? 'L’expéditeur'} et ${d.travelerName ?? 'le voyageur'} sont en désaccord sur ce colis.`
}

function noShowGroupTitle(r: AdminNoShow): string {
  const handover = r.scope ? r.scope === 'HANDOVER' : r.reason === 'SENDER_NO_SHOW'
  return handover ? 'Déclaration d’absence à la remise' : 'Déclaration d’absence à la livraison'
}

// ---- Construction ----

export function disputeIncident(d: AdminDisputeListItem): Incident {
  return {
    key: `dispute:${d.id}`, kind: 'DISPUTE', id: d.id, bidId: d.bidId, createdAt: d.createdAt,
    todo: d.status === 'OPEN', title: disputeTypeLabel(d.type), dispute: d, noshow: null,
  }
}

/** Une déclaration attend l'arbitrage tant qu'elle est en attente ou contestée et qu'aucun admin n'a tranché. */
export function noShowNeedsDecision(r: AdminNoShow): boolean {
  return !r.adminDecision && (r.status === 'PENDING_CONFIRMATION' || r.status === 'CONTESTED')
}

export function noShowIncident(r: AdminNoShow): Incident {
  return {
    key: `noshow:${r.id}`, kind: 'NOSHOW', id: r.id, bidId: r.bidId, createdAt: r.createdAt,
    todo: noShowNeedsDecision(r), title: noShowGroupTitle(r), dispute: null, noshow: r,
  }
}

export const disputeKey = (id: string) => `dispute:${id}`
export const noShowKey = (id: string) => `noshow:${id}`

// ---- Lecture d'une ligne ----

/** Ligne principale : « Koro DIAKITE → Ibra DIANE » pour un litige, la phrase de la déclaration pour une absence. */
export function incidentLabel(i: Incident): string {
  if (i.dispute) return `${i.dispute.senderName ?? '—'} → ${i.dispute.travelerName ?? '—'}`
  return noShowTitle(i.noshow!)
}

/** Ligne secondaire : trajet et montant d'une absence, remboursement gelé d'un litige. */
export function incidentSubtitle(i: Incident): string | null {
  if (i.dispute) return i.dispute.refundFrozen ? 'Remboursement gelé' : null
  const r = i.noshow!
  const parts = [tripLabel(r.trip), amountLabel(r)].filter((x): x is string => !!x)
  return parts.length ? parts.join(' · ') : null
}

export function incidentStatusMeta(i: Incident): { label: string; tone: Tone } {
  return i.dispute ? disputeStatusMeta(i.dispute.status) : noShowStatusMeta(i.noshow!.status, i.noshow!.adminDecision)
}

function createdMs(i: Pick<Incident, 'createdAt'>): number {
  const ms = parseServerDate(i.createdAt)
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms
}

/**
 * Délai d'un incident à traiter. Une absence en attente affiche le temps qui reste pour contester
 * (urgent sous 2 h ou échu) ; un litige ou une absence contestée affiche son ancienneté, en retard
 * au-delà de 7 jours. Null pour un incident déjà traité.
 */
export function incidentAge(i: Incident, now: number = Date.now()): { label: string; tone: 'neutral' | 'warning' | 'danger' } | null {
  if (!i.todo) return null
  if (i.noshow) {
    const left = remainingMeta(i.noshow, now)
    if (left) return { label: left.label, tone: left.urgent ? 'danger' : 'warning' }
  }
  const created = parseServerDate(i.createdAt)
  const elapsed = Number.isNaN(created) ? 0 : Math.max(0, now - created)
  const tone = elapsed >= LATE_AFTER ? 'danger' : elapsed >= WATCH_AFTER ? 'warning' : 'neutral'
  if (elapsed < HOUR) return { label: '< 1 h', tone }
  if (elapsed < DAY) return { label: `${Math.floor(elapsed / HOUR)} h`, tone }
  return { label: `${Math.floor(elapsed / DAY)} j`, tone }
}

/** En retard : un litige ou une absence contestée ouverts depuis plus de 7 jours, une absence dont le délai de contestation est échu. */
function isLate(i: Incident, now: number): boolean {
  const left = i.noshow ? remainingMeta(i.noshow, now) : null
  if (left) return left.label === 'échu'
  return incidentAge(i, now)?.tone === 'danger'
}

/** Urgence pour trier : 4 échéance courte, 3 en retard ou contesté, 2 à traiter, 1 traité. */
function rank(i: Incident, now: number): number {
  if (!i.todo) return 1
  if (i.noshow && remainingMeta(i.noshow, now)?.urgent) return 4
  if (i.noshow?.status === 'CONTESTED') return 3
  return incidentAge(i, now)?.tone === 'danger' ? 3 : 2
}

// ---- File ----

export interface IncidentGroup {
  key: string
  title: string
  kind: IncidentKind
  /** Urgence du plus pressant des incidents du groupe. */
  rank: number
  /** Du plus ancien au plus récent : on traite d'abord celui qui attend depuis le plus longtemps. */
  incidents: Incident[]
}

export function groupIncidents(items: readonly Incident[], now: number = Date.now()): IncidentGroup[] {
  const byKey = new Map<string, IncidentGroup>()
  for (const i of items) {
    const key = `${i.kind}:${i.title}`
    const r = rank(i, now)
    const g = byKey.get(key)
    if (g) { g.incidents.push(i); g.rank = Math.max(g.rank, r) }
    else byKey.set(key, { key, title: i.title, kind: i.kind, rank: r, incidents: [i] })
  }
  const groups = [...byKey.values()]
  for (const g of groups) g.incidents.sort((a, b) => createdMs(a) - createdMs(b))
  return groups.sort((a, b) => b.rank - a.rank || createdMs(a.incidents[0]!) - createdMs(b.incidents[0]!))
}

/** Incidents dans l'ordre d'affichage : ce que J et K parcourent. */
export function queueOrder(groups: readonly IncidentGroup[]): Incident[] {
  return groups.flatMap((g) => g.incidents)
}

export interface IncidentFilter { query: string; kind: KindFilter }

/** Nature (litiges, absences) et recherche libre : noms, colis, trajet, motif. */
export function filterIncidents(items: readonly Incident[], { query, kind }: IncidentFilter): Incident[] {
  const q = query.trim().toLowerCase()
  return items.filter((i) => {
    if (kind !== 'ALL' && i.kind !== kind) return false
    if (!q) return true
    const r = i.noshow
    const haystack = [
      i.title, i.id, i.bidId, i.dispute?.type, i.dispute?.senderName, i.dispute?.travelerName,
      r && noShowSentence(r), r?.declarant?.name, r?.accused?.name, r && tripLabel(r.trip),
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(q)
  })
}

export interface IncidentSummary {
  todo: number
  disputes: number
  noshows: number
  /** À traiter depuis plus de 7 jours, ou dont le délai de contestation est échu. */
  late: number
  /** Litiges à traiter dont le remboursement est gelé. */
  frozen: number
  /** Absences dont le délai de contestation se termine dans moins de 2 h. */
  urgent: number
}

export function summarizeIncidents(items: readonly Incident[], now: number = Date.now()): IncidentSummary {
  const todo = items.filter((i) => i.todo)
  return {
    todo: todo.length,
    disputes: todo.filter((i) => i.kind === 'DISPUTE').length,
    noshows: todo.filter((i) => i.kind === 'NOSHOW').length,
    late: todo.filter((i) => isLate(i, now)).length,
    frozen: todo.filter((i) => i.dispute?.refundFrozen).length,
    urgent: todo.filter((i) => i.noshow && remainingMeta(i.noshow, now)?.urgent).length,
  }
}

// ---- Sélection ----

export const defaultIncidentKey = (order: readonly Incident[]): string | null => order[0]?.key ?? null

/** Voisin dans la file (J / K) ; sans sélection, le premier. Reste sur place aux extrémités. */
export function neighbourIncidentKey(order: readonly Incident[], currentKey: string | null, step: 1 | -1): string | null {
  if (order.length === 0) return null
  const from = order.findIndex((i) => i.key === currentKey)
  if (from === -1) return order[0]!.key
  return order[Math.min(order.length - 1, Math.max(0, from + step))]!.key
}

/** Après une décision : le suivant, à défaut le précédent ; null s'il n'en reste aucun. */
export function followingIncidentKey(order: readonly Incident[], currentKey: string | null): string | null {
  const from = order.findIndex((i) => i.key === currentKey)
  if (from === -1) return order[0]?.key ?? null
  return order[from + 1]?.key ?? order[from - 1]?.key ?? null
}

// ---- Décision ----

export type IncidentAction =
  | 'RESOLVED_FOR_SENDER' | 'RESOLVED_FOR_TRAVELER' | 'SPLIT' | 'GUARANTEE' | 'DISMISSED'
  | 'NOSHOW_CONFIRM' | 'NOSHOW_REJECT'

export const INCIDENT_ACTION_LABELS: Record<IncidentAction, string> = {
  RESOLVED_FOR_SENDER: 'Trancher pour l’expéditeur',
  RESOLVED_FOR_TRAVELER: 'Trancher pour le voyageur',
  SPLIT: 'Partager le séquestre',
  GUARANTEE: 'Verser le fonds de garantie',
  DISMISSED: 'Classer sans suite',
  NOSHOW_CONFIRM: 'Confirmer l’absence',
  NOSHOW_REJECT: 'Rejeter la déclaration',
}
export const INCIDENT_ACTION_HELP: Record<IncidentAction, string> = {
  RESOLVED_FOR_SENDER: 'Le litige est clos en faveur de l’expéditeur.',
  RESOLVED_FOR_TRAVELER: 'Le litige est clos en faveur du voyageur.',
  SPLIT: 'Une part est remboursée à l’expéditeur, l’autre versée au voyageur.',
  GUARANTEE: 'Yadony verse une aide prise sur le fonds de garantie.',
  DISMISSED: 'Aucune suite : le litige est clos sans décision sur l’argent.',
  NOSHOW_CONFIRM: 'L’absence est établie.',
  NOSHOW_REJECT: 'La déclaration est classée, le colis continue.',
}

/** Gestes proposés selon l'incident ; vide quand il est déjà traité. Partager exige les deux droits d'argent. */
export function incidentActionsFor(i: Incident, can: { resolve: boolean; split: boolean }): IncidentAction[] {
  if (!can.resolve || !i.todo) return []
  if (i.dispute) {
    const list: IncidentAction[] = ['RESOLVED_FOR_SENDER', 'RESOLVED_FOR_TRAVELER']
    if (can.split) list.push('SPLIT')
    list.push('GUARANTEE', 'DISMISSED')
    return list
  }
  const r = i.noshow!
  const list: IncidentAction[] = []
  if (r.canConfirm) list.push('NOSHOW_CONFIRM')
  if (r.canReject) list.push('NOSHOW_REJECT')
  return list
}

export const NOTE_MIN = 3
export const NOTE_MAX = 500

export const isNoShowAction = (a: IncidentAction): a is 'NOSHOW_CONFIRM' | 'NOSHOW_REJECT' => a === 'NOSHOW_CONFIRM' || a === 'NOSHOW_REJECT'
export const noShowDecisionOf = (a: 'NOSHOW_CONFIRM' | 'NOSHOW_REJECT'): NoShowDecision => (a === 'NOSHOW_CONFIRM' ? 'confirm' : 'reject')

/** Les formulaires de partage et de fonds de garantie portent leur propre note. */
export const hasOwnForm = (a: IncidentAction): boolean => a === 'SPLIT' || a === 'GUARANTEE'

/** Note d'un geste : 10 à 500 caractères pour une absence (contrat du back), 3 à 500 pour un litige. */
export function incidentNoteError(note: string, action: IncidentAction, legacy = false): string | null {
  if (isNoShowAction(action) && legacy) return null
  const min = isNoShowAction(action) ? NOSHOW_REASON_MIN : NOTE_MIN
  const max = isNoShowAction(action) ? NOSHOW_REASON_MAX : NOTE_MAX
  const n = note.trim().length
  if (n < min) return `Indiquez ce que vous avez vérifié (${min} caractères au moins).`
  if (n > max) return `Note trop longue (${max} caractères au plus).`
  return null
}

export const INCIDENT_QUICK_NOTES: Record<'dispute' | 'noshow', string[]> = {
  dispute: ['Preuves examinées', 'Accord des deux parties', 'Aucune réponse de l’autre partie'],
  noshow: ['Appel au voyageur sans réponse', 'Preuve de présence fournie', 'Aucune contestation reçue'],
}
