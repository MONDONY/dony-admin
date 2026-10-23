import { bidStatusMeta } from '@/features/bids/components/bidStatus'
import { announcementStatusMeta } from '@/features/bids/lib/bidLabels'
import { formatAmount } from '@/features/finance/types/index'
import { paymentStatusMeta } from '@/features/payments/components/paymentStatus'
import { REPORT_REASON_LABELS } from '@/features/signalements/reportReasons'
import { REPORT_TARGET_TYPE_LABELS } from '@/features/signalements/reportActionLabels'
import { reportStatusMeta } from '@/features/signalements/components/reportStatus'
import { auditActionLabel } from '@/features/user-profile/lib/auditActionLabels'
import { formatDayUtc } from '@/features/user-profile/lib/formatDayUtc'
import { formatInstant } from '@/features/user-profile/lib/formatInstant'
import type { BidStatus } from '@/features/bids/types/index'
import type { PaymentStatus } from '@/features/payments/types/index'
import type { ReportStatus } from '@/features/signalements/types/index'
import type {
  UserAuditRow, UserCancellationRow, UserDisputeRow, UserParcelRow, UserPaymentRow, UserRatingRow,
  UserReportRow, UserRequestRow, UserTripRow,
} from '@/features/user-profile/types/index'

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface SectionColumn {
  key: string
  label: string
  /** Texte de la cellule ; sans `format`, la valeur brute de `row[key]`. */
  // eslint-disable-next-line no-unused-vars
  format?: (row: any) => string
  /** Présent : la cellule est un badge de ce ton (null = texte simple) (le texte reste porté par `format`). */
  // eslint-disable-next-line no-unused-vars
  tone?: (row: any) => Tone | null
}

type Meta = { label: string; tone: Tone }

/** Code inconnu : « SOME_CODE » devient « Some code », jamais un badge vide. */
export function humanize(code: string | null | undefined): string {
  if (!code) return '—'
  const words = code.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const ROLES: Record<string, string> = {
  SENDER: 'Expéditeur', TRAVELER: 'Voyageur', REPORTER: 'Déclarant', PAYER: 'Payeur', BENEFICIARY: 'Bénéficiaire',
}
/** Rôle inconnu : valeur brute. */
export const roleLabel = (r: string | null | undefined): string => (r ? (ROLES[r] ?? r) : '—')

const money = (cents: number | null | undefined, currency: string | null | undefined): string =>
  cents == null || !currency ? '—' : formatAmount(cents, currency)

// eslint-disable-next-line no-unused-vars
function statusCol(key: string, metaOf: (s: string) => Meta, label = 'Statut'): SectionColumn {
  return {
    key, label,
    format: r => (r[key] ? metaOf(r[key]).label : '—'),
    tone: r => (r[key] ? metaOf(r[key]).tone : 'neutral'),
  }
}

const bidMeta = (s: string): Meta => bidStatusMeta(s as BidStatus)
const tripMeta = (s: string): Meta => announcementStatusMeta(s)
const paymentMeta = (s: string): Meta => paymentStatusMeta(s as PaymentStatus) ?? { label: unlisted('Statut', s), tone: 'neutral' }
const reportMeta = (s: string): Meta => reportStatusMeta(s as ReportStatus) ?? { label: unlisted('Statut', s), tone: 'neutral' }

const REQUEST_STATUS: Record<string, Meta> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  OPEN: { label: 'Ouverte', tone: 'info' },
  NEGOTIATING: { label: 'En négociation', tone: 'info' },
  ACCEPTED: { label: 'Acceptée', tone: 'info' },
  EXPIRED: { label: 'Expirée', tone: 'neutral' },
  CANCELLED: { label: 'Annulée', tone: 'danger' },
  COMPLETED: { label: 'Terminée', tone: 'success' },
  REMOVED_BY_ADMIN: { label: 'Retirée par l’admin', tone: 'danger' },
}
const requestMeta = (s: string): Meta => REQUEST_STATUS[s] ?? { label: unlisted('Statut', s), tone: 'neutral' }

const DISPUTE_STATUS: Record<string, Meta> = {
  OPEN: { label: 'Ouvert', tone: 'warning' },
  RESOLVED: { label: 'Résolu', tone: 'success' },
}
const disputeMeta = (s: string): Meta => DISPUTE_STATUS[s] ?? { label: unlisted('Statut', s), tone: 'neutral' }

const CANCELLATION_STATUS: Record<string, Meta> = {
  PENDING_CONFIRMATION: { label: 'En attente de confirmation', tone: 'warning' },
  CONTESTED: { label: 'Contestée', tone: 'danger' },
  CONFIRMED: { label: 'Confirmée', tone: 'info' },
  RESOLVED: { label: 'Résolue', tone: 'success' },
}
const cancellationMeta = (s: string): Meta => CANCELLATION_STATUS[s] ?? { label: unlisted('Statut', s), tone: 'neutral' }

/** Code absent de nos catalogues : texte français neutre, le code brut reste lisible entre parenthèses. */
export const unlisted = (what: string, code: string | null | undefined, feminine = false): string =>
  code ? `${what} non répertorié${feminine ? 'e' : ''} (${code})` : '—'

const SCOPES: Record<string, string> = { HANDOVER: 'Remise', DELIVERY: 'Livraison' }
export const scopeLabel = (c: string | null | undefined): string => (c ? (SCOPES[c] ?? unlisted('Portée', c, true)) : '—')

const ADMIN_DISPUTE_REASONS: Record<string, string> = {
  PARCEL_DAMAGED: 'Colis abîmé',
  PARCEL_LOST: 'Colis perdu',
  PARCEL_NOT_DELIVERED: 'Colis non livré',
  CONTENT_MISMATCH: 'Contenu non conforme',
  PAYMENT_DISAGREEMENT: 'Désaccord sur le paiement',
  PARTY_BEHAVIOUR: 'Comportement d’une partie',
  OTHER: 'Autre',
}
const DISPUTE_TYPES: Record<string, string> = {
  SENDER_NO_SHOW_CONTESTED: 'Absence de l’expéditeur contestée',
  RECIPIENT_NO_SHOW: 'Destinataire absent',
  RECIPIENT_NO_SHOW_CONTESTED: 'Absence du destinataire contestée',
  TRAVELER_DELIVERY_NO_SHOW: 'Voyageur absent à la livraison',
  TRAVELER_DELIVERY_NO_SHOW_CONTESTED: 'Absence du voyageur à la livraison contestée',
}
export function disputeTypeLabel(t: string | null | undefined): string {
  if (!t) return '—'
  if (DISPUTE_TYPES[t]) return DISPUTE_TYPES[t]
  if (t.startsWith('ADMIN_')) {
    const reason = ADMIN_DISPUTE_REASONS[t.slice('ADMIN_'.length)]
    if (reason) return `Ouvert par l’administration : ${reason}`
  }
  return unlisted('Type', t)
}

const CANCELLATION_REASONS: Record<string, string> = {
  OTHER: 'Autre',
  SENDER_NO_SHOW: 'Expéditeur absent à la remise',
  RECIPIENT_NO_SHOW: 'Destinataire absent à la livraison',
  TRAVELER_DELIVERY_NO_SHOW: 'Voyageur absent à la livraison',
  TRIP_CANCELLED: 'Trajet annulé',
  MUTUAL_AGREEMENT: 'Accord entre les parties',
  SENDER_CANCEL_AFTER_HANDOVER: 'Annulation par l’expéditeur après la remise',
  TRAVELER_CANCEL_AFTER_HANDOVER: 'Annulation par le voyageur après la remise',
  BID_CANCELLED_BY_TRAVELER: 'Colis annulé par le voyageur',
  BID_REJECTED_AFTER_PAYMENT: 'Colis refusé après paiement',
  TRAVELER_ACCOUNT_DELETED: 'Compte du voyageur supprimé',
  TRIP_RESCHEDULE_WITHDRAWN: 'Report de trajet retiré',
}
const cancellationReasonLabel = (c: string | null | undefined): string =>
  c ? (CANCELLATION_REASONS[c] ?? unlisted('Motif', c)) : '—'
const reportReason = (c: string): string => (REPORT_REASON_LABELS[c] ?? unlisted('Motif', c))
const reportTarget = (c: string): string => REPORT_TARGET_TYPE_LABELS[c as keyof typeof REPORT_TARGET_TYPE_LABELS] ?? unlisted('Type', c)

const METHODS: Record<string, string> = { STRIPE: 'Carte bancaire', PAWAPAY: 'Mobile money' }

export const parcelColumns: SectionColumn[] = [
  { key: 'trackingNumber', label: 'Référence', format: (r: UserParcelRow) => r.trackingNumber ?? r.id.slice(0, 8) },
  { key: 'corridor', label: 'Trajet' },
  { key: 'role', label: 'Rôle', format: (r: UserParcelRow) => roleLabel(r.role) },
  statusCol('status', bidMeta),
  { key: 'createdAt', label: 'Créé le', format: (r: UserParcelRow) => formatInstant(r.createdAt) },
  { key: 'deliveredAt', label: 'Livré le', format: (r: UserParcelRow) => formatInstant(r.deliveredAt) },
  { key: 'amount', label: 'Montant', format: (r: UserParcelRow) => (r.amount ? money(r.amount.amountCents, r.amount.currency) : '—') },
]

export const tripColumns: SectionColumn[] = [
  { key: 'corridor', label: 'Trajet' },
  { key: 'departureDate', label: 'Départ', format: (r: UserTripRow) => formatDayUtc(r.departureDate) },
  statusCol('status', tripMeta),
  { key: 'availableKg', label: 'Kilos disponibles', format: (r: UserTripRow) => `${r.availableKg} kg` },
  {
    key: 'pricePerKg', label: 'Prix au kilo',
    // Prix par kilo en unités principales (pas en centimes) : pas de formatAmount ici.
    format: (r: UserTripRow) => (r.pricePerKg == null ? '—' : `${r.pricePerKg.toLocaleString('fr-FR')} ${r.currency ?? ''}`.trim()),
  },
  {
    key: 'tripLegIndex', label: 'Étape',
    format: (r: UserTripRow) => (r.tripLegCount && r.tripLegCount > 1 && r.tripLegIndex != null ? `${r.tripLegIndex + 1} sur ${r.tripLegCount}` : '—'),
  },
]

export const requestColumns: SectionColumn[] = [
  { key: 'corridor', label: 'Trajet' },
  statusCol('status', requestMeta),
  { key: 'weightKg', label: 'Poids', format: (r: UserRequestRow) => (r.weightKg == null ? '—' : `${r.weightKg} kg`) },
  { key: 'desiredDate', label: 'Date souhaitée', format: (r: UserRequestRow) => formatDayUtc(r.desiredDate) },
  { key: 'createdAt', label: 'Créée le', format: (r: UserRequestRow) => formatInstant(r.createdAt) },
  { key: 'openNegotiationCount', label: 'Négociations ouvertes', format: (r: UserRequestRow) => String(r.openNegotiationCount) },
]

export const paymentColumns: SectionColumn[] = [
  { key: 'createdAt', label: 'Date', format: (r: UserPaymentRow) => formatInstant(r.createdAt) },
  { key: 'role', label: 'Rôle', format: (r: UserPaymentRow) => roleLabel(r.role) },
  { key: 'method', label: 'Moyen', format: (r: UserPaymentRow) => (r.method ? (METHODS[r.method] ?? r.method) : '—') },
  statusCol('status', paymentMeta),
  { key: 'amountCents', label: 'Montant', format: (r: UserPaymentRow) => money(r.amountCents, r.currency) },
  { key: 'commissionCents', label: 'Commission', format: (r: UserPaymentRow) => money(r.commissionCents, r.currency) },
  {
    key: 'beneficiaryHeld', label: 'Versement',
    format: (r: UserPaymentRow) => (r.beneficiaryHeld ? (r.payoutHeldAt ? `Retenu depuis le ${formatInstant(r.payoutHeldAt)}` : 'Retenu') : '—'),
    tone: (r: UserPaymentRow) => (r.beneficiaryHeld ? 'warning' : null),
  },
]

export const disputeColumns: SectionColumn[] = [
  { key: 'createdAt', label: 'Ouvert le', format: (r: UserDisputeRow) => formatInstant(r.createdAt) },
  { key: 'type', label: 'Type', format: (r: UserDisputeRow) => disputeTypeLabel(r.type) },
  { key: 'role', label: 'Rôle', format: (r: UserDisputeRow) => roleLabel(r.role) },
  statusCol('status', disputeMeta),
  { key: 'resolvedAt', label: 'Résolu le', format: (r: UserDisputeRow) => formatInstant(r.resolvedAt) },
]

export const cancellationColumns: SectionColumn[] = [
  { key: 'createdAt', label: 'Date', format: (r: UserCancellationRow) => formatInstant(r.createdAt) },
  { key: 'declaredByUser', label: 'Déclarée par', format: (r: UserCancellationRow) => (r.declaredByUser ? 'Ce compte' : 'L’autre partie') },
  { key: 'scope', label: 'Portée', format: (r: UserCancellationRow) => scopeLabel(r.scope) },
  { key: 'reason', label: 'Motif', format: (r: UserCancellationRow) => cancellationReasonLabel(r.reason) },
  statusCol('status', cancellationMeta),
]

export const reportColumns: SectionColumn[] = [
  { key: 'createdAt', label: 'Date', format: (r: UserReportRow) => formatInstant(r.createdAt) },
  { key: 'targetType', label: 'Cible', format: (r: UserReportRow) => reportTarget(r.targetType) },
  { key: 'reason', label: 'Motif', format: (r: UserReportRow) => reportReason(r.reason) },
  statusCol('status', reportMeta),
]

export const ratingColumns: SectionColumn[] = [
  { key: 'createdAt', label: 'Date', format: (r: UserRatingRow) => formatInstant(r.createdAt) },
  { key: 'stars', label: 'Note', format: (r: UserRatingRow) => `${r.stars} sur 5` },
  { key: 'comment', label: 'Commentaire', format: (r: UserRatingRow) => r.comment || '—' },
  {
    key: 'flagged', label: 'Signalé',
    format: (r: UserRatingRow) => (r.flagged ? 'Signalé' : 'Non'),
    tone: (r: UserRatingRow) => (r.flagged ? 'warning' : 'neutral'),
  },
]

export const auditColumns: SectionColumn[] = [
  { key: 'createdAt', label: 'Date', format: (r: UserAuditRow) => formatInstant(r.createdAt) },
  { key: 'action', label: 'Action', format: (r: UserAuditRow) => auditActionLabel(r.action) },
  { key: 'actorName', label: 'Par', format: (r: UserAuditRow) => r.actorName ?? '—' },
  { key: 'reason', label: 'Motif', format: (r: UserAuditRow) => r.reason || '—' },
]

/** Liens vers les écrans existants ; null quand aucun lien n'existe. */
export const parcelLink = (r: UserParcelRow): string => `/colis?open=${r.id}`
export const tripLink = (r: UserTripRow): string => `/colis?tab=announcements&announcement=${r.id}`
export const requestLink = (r: UserRequestRow): string => `/colis?tab=demandes&open=${r.id}`
export const paymentLink = (r: UserPaymentRow): string => `/transactions?open=${r.id}`
export const disputeLink = (r: UserDisputeRow): string => `/incidents?open=${r.id}`
export const reportLink = (r: UserReportRow): string => `/signalements?open=${r.id}`
