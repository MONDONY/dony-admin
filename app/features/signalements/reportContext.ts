import { reportActionTakenLabel } from '@/features/signalements/reportActionLabels'
import type {
  AdminReport,
  ReportContextReporter,
  ReportSameScreen,
  ReportContextSubject,
  ReportHistoryEntry,
} from '@/features/signalements/types/index'

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

/** Seuil à partir duquel les proportions disent quelque chose : en dessous, trop peu de signalements. */
const MIN_REPORTS_FOR_RATIO = 3
const RATIO = 0.6

/**
 * Ce que l'historique du signalant laisse penser, en un mot. Des proportions, pas un verdict :
 * l'admin garde la main, c'est un repère pour lire un signalement dans son contexte.
 */
export function reporterTrust(r: Pick<ReportContextReporter, 'totalReports' | 'resolvedReports' | 'dismissedReports'>): { label: string; tone: Tone } {
  if (r.totalReports <= 1) return { label: 'Premier signalement', tone: 'neutral' }
  if (r.totalReports < MIN_REPORTS_FOR_RATIO) return { label: 'Peu d’historique', tone: 'neutral' }
  if (r.resolvedReports / r.totalReports >= RATIO) return { label: 'Fiable', tone: 'success' }
  if (r.dismissedReports / r.totalReports >= RATIO) return { label: 'À prendre avec recul', tone: 'warning' }
  return { label: 'Historique mitigé', tone: 'neutral' }
}

/** « Membre depuis mars 2026 » ; null sans date exploitable. */
export function memberSinceLabel(iso?: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `Membre depuis ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
}

/** Statut du compte visé, rien à signaler quand il est actif. */
export function accountStatusMeta(status?: string | null): { label: string; tone: Tone } | null {
  switch (status) {
    case 'SUSPENDED': return { label: 'Compte suspendu', tone: 'danger' }
    case 'BANNED': return { label: 'Compte banni', tone: 'danger' }
    case 'PENDING_DELETION': return { label: 'Suppression demandée', tone: 'warning' }
    default: return null
  }
}

/** Phrase des signalements reçus : « 3 signalements reçus, dont 1 ouvert ». */
export function receivedReportsText(s: Pick<ReportContextSubject, 'reportsReceived' | 'openReportsReceived'>): string {
  const plural = (n: number) => (n > 1 ? 's' : '')
  if (s.reportsReceived === 0) return 'Aucun signalement reçu'
  const base = `${s.reportsReceived} signalement${plural(s.reportsReceived)} reçu${plural(s.reportsReceived)}`
  return s.openReportsReceived > 0 ? `${base}, dont ${s.openReportsReceived} ouvert${plural(s.openReportsReceived)}` : base
}

/** Phrase des signalements du signalant : « 4 signalements, 3 traités, 1 rejeté ». */
export function reporterHistoryText(r: Pick<ReportContextReporter, 'totalReports' | 'resolvedReports' | 'dismissedReports'>): string {
  const plural = (n: number) => (n > 1 ? 's' : '')
  const parts = [`${r.totalReports} signalement${plural(r.totalReports)}`]
  if (r.resolvedReports > 0) parts.push(`${r.resolvedReports} traité${plural(r.resolvedReports)}`)
  if (r.dismissedReports > 0) parts.push(`${r.dismissedReports} rejeté${plural(r.dismissedReports)}`)
  return parts.join(', ')
}

export interface TimelineItem {
  key: string
  label: string
  at: string | null
  /** « par sira@yadony.com » ou « par Awa Diallo ». */
  by: string | null
  note: string | null
}

const AUDIT_LABELS: Record<string, string> = {
  REPORT_DELETED: 'Signalement supprimé',
  REPORT_RESTORED: 'Signalement restauré',
}

function auditLabel(e: ReportHistoryEntry): string {
  if (e.action === 'REPORT_RESOLVED') return e.detail ? reportActionTakenLabel(e.detail) : 'Signalement traité'
  return AUDIT_LABELS[e.action] ?? e.action
}

/**
 * Chronologie du dossier, du plus ancien au plus récent : la réception, puis chaque geste tracé
 * (le back les rend du plus récent au plus ancien).
 */
export function buildTimeline(report: Pick<AdminReport, 'id' | 'createdAt' | 'reporterName'>, history: readonly ReportHistoryEntry[] | null | undefined): TimelineItem[] {
  const received: TimelineItem = {
    key: `received-${report.id}`, label: 'Signalement reçu', at: report.createdAt,
    by: report.reporterName ? `par ${report.reporterName}` : null, note: null,
  }
  const steps = [...(history ?? [])].reverse().map((e, i): TimelineItem => ({
    key: `${e.action}-${i}`, label: auditLabel(e), at: e.at ?? null,
    by: e.actorEmail ? `par ${e.actorEmail}` : null, note: e.note ?? null,
  }))
  return [received, ...steps]
}

// ----- Fiche de la cible -----

const KIND_TITLES: Record<string, string> = {
  ANNOUNCEMENT: 'L’annonce',
  PACKAGE_REQUEST: 'La demande d’envoi',
  BID: 'L’offre',
}

/** « L’annonce », « La demande d’envoi », « L’offre » ; un type ajouté côté back s'affiche tel quel. */
export function targetKindTitle(kind: string): string {
  return KIND_TITLES[kind] ?? kind
}

const ANNOUNCEMENT_STATUS: Record<string, string> = {
  DRAFT: 'Brouillon', ACTIVE: 'En ligne', FULL: 'Complète', IN_PROGRESS: 'En cours', COMPLETED: 'Terminée',
  CANCELLED: 'Annulée', REMOVED_BY_ADMIN: 'Retirée par l’équipe',
}
const REQUEST_STATUS: Record<string, string> = {
  DRAFT: 'Brouillon', OPEN: 'Ouverte', NEGOTIATING: 'En négociation', ACCEPTED: 'Acceptée', EXPIRED: 'Expirée',
  CANCELLED: 'Annulée', COMPLETED: 'Terminée', REMOVED_BY_ADMIN: 'Retirée par l’équipe',
}
const BID_STATUS: Record<string, string> = {
  AWAITING_PAYMENT: 'En attente de paiement', PENDING: 'En attente', PAYMENT_ESCROWED: 'Paiement bloqué',
  ACCEPTED: 'Acceptée', HANDED_OVER: 'Colis remis', IN_TRANSIT: 'En transit', ARRIVED: 'Arrivé', REJECTED: 'Refusée',
  CANCELLED: 'Annulée', COMPLETED: 'Terminée', NO_SHOW: 'Absence', PARCEL_REFUSED: 'Colis refusé',
  EXPIRED: 'Expirée', NEGOTIATING: 'En négociation',
}
const STATUS_BY_KIND: Record<string, Record<string, string>> = {
  ANNOUNCEMENT: ANNOUNCEMENT_STATUS, PACKAGE_REQUEST: REQUEST_STATUS, BID: BID_STATUS,
}

/** Statut lisible de la cible et sa teinte ; un statut inconnu reste brut, en neutre. */
export function targetStatusMeta(kind: string, status?: string | null): { label: string; tone: Tone } | null {
  if (!status) return null
  const label = STATUS_BY_KIND[kind]?.[status] ?? status
  const removed = status === 'REMOVED_BY_ADMIN' || status === 'REJECTED' || status === 'PARCEL_REFUSED' || status === 'NO_SHOW'
  const live = status === 'ACTIVE' || status === 'OPEN' || status === 'ACCEPTED' || status === 'COMPLETED'
  const tone: Tone = removed ? 'danger' : live ? 'success' : 'neutral'
  return { label, tone }
}

/** À partir de combien de retours sur une même route on parle d'un problème qui se répète. */
const REPEATED_SCREEN = 3

/** « 7 retours sur cet écran, dont 5 ouverts », avec un repère quand ça se répète. */
export function sameScreenSummary(s: Pick<ReportSameScreen, 'total' | 'open'>): { text: string; repeated: boolean } {
  const plural = (n: number) => (n > 1 ? 's' : '')
  const base = `${s.total} retour${plural(s.total)} sur cet écran`
  return {
    text: s.open > 0 && s.total > 1 ? `${base}, dont ${s.open} ouvert${plural(s.open)}` : base,
    repeated: s.total >= REPEATED_SCREEN,
  }
}
