import { bidStatusMeta } from '@/features/bids/components/bidStatus'
import { announcementStatusMeta } from '@/features/bids/lib/bidLabels'
import { formatAmount } from '@/features/finance/types/index'
import { paymentStatusMeta } from '@/features/payments/components/paymentStatus'
import { reportStatusMeta } from '@/features/signalements/components/reportStatus'
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
  /** Présent : la cellule est un badge de ce ton (le texte reste porté par `format`). */
  // eslint-disable-next-line no-unused-vars
  tone?: (row: any) => Tone
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
const paymentMeta = (s: string): Meta => paymentStatusMeta(s as PaymentStatus) ?? { label: humanize(s), tone: 'neutral' }
const reportMeta = (s: string): Meta => reportStatusMeta(s as ReportStatus) ?? { label: humanize(s), tone: 'neutral' }

const REQUEST_STATUS: Record<string, Meta> = {
  OPEN: { label: 'Ouverte', tone: 'info' },
  ACTIVE: { label: 'Active', tone: 'info' },
  MATCHED: { label: 'Prise en charge', tone: 'success' },
  CLOSED: { label: 'Clôturée', tone: 'neutral' },
  EXPIRED: { label: 'Expirée', tone: 'neutral' },
  CANCELLED: { label: 'Annulée', tone: 'danger' },
}
const requestMeta = (s: string): Meta => REQUEST_STATUS[s] ?? { label: humanize(s), tone: 'neutral' }

const DISPUTE_STATUS: Record<string, Meta> = {
  OPEN: { label: 'Ouvert', tone: 'warning' },
  RESOLVED: { label: 'Résolu', tone: 'success' },
}
const disputeMeta = (s: string): Meta => DISPUTE_STATUS[s] ?? { label: humanize(s), tone: 'neutral' }

const CANCELLATION_STATUS: Record<string, Meta> = {
  PENDING: { label: 'En attente', tone: 'warning' },
  CONFIRMED: { label: 'Confirmée', tone: 'info' },
  CANCELLED: { label: 'Annulée', tone: 'danger' },
  COMPLETED: { label: 'Terminée', tone: 'success' },
}
const cancellationMeta = (s: string): Meta => CANCELLATION_STATUS[s] ?? { label: humanize(s), tone: 'neutral' }

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
    format: (r: UserPaymentRow) => (r.beneficiaryHeld ? `Retenu depuis le ${formatInstant(r.payoutHeldAt)}` : '—'),
    tone: (r: UserPaymentRow) => (r.beneficiaryHeld ? 'warning' : 'neutral'),
  },
]

export const disputeColumns: SectionColumn[] = [
  { key: 'createdAt', label: 'Ouvert le', format: (r: UserDisputeRow) => formatInstant(r.createdAt) },
  { key: 'type', label: 'Type', format: (r: UserDisputeRow) => humanize(r.type) },
  { key: 'role', label: 'Rôle', format: (r: UserDisputeRow) => roleLabel(r.role) },
  statusCol('status', disputeMeta),
  { key: 'resolvedAt', label: 'Résolu le', format: (r: UserDisputeRow) => formatInstant(r.resolvedAt) },
]

export const cancellationColumns: SectionColumn[] = [
  { key: 'createdAt', label: 'Date', format: (r: UserCancellationRow) => formatInstant(r.createdAt) },
  { key: 'declaredByUser', label: 'Déclarée par', format: (r: UserCancellationRow) => (r.declaredByUser ? 'Ce compte' : 'L’autre partie') },
  { key: 'scope', label: 'Portée', format: (r: UserCancellationRow) => (r.scope ? humanize(r.scope) : '—') },
  { key: 'reason', label: 'Motif', format: (r: UserCancellationRow) => (r.reason ? humanize(r.reason) : '—') },
  statusCol('status', cancellationMeta),
]

export const reportColumns: SectionColumn[] = [
  { key: 'createdAt', label: 'Date', format: (r: UserReportRow) => formatInstant(r.createdAt) },
  { key: 'targetType', label: 'Cible', format: (r: UserReportRow) => humanize(r.targetType) },
  { key: 'reason', label: 'Motif', format: (r: UserReportRow) => humanize(r.reason) },
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
  { key: 'action', label: 'Action', format: (r: UserAuditRow) => humanize(r.action) },
  { key: 'actorName', label: 'Par', format: (r: UserAuditRow) => r.actorName ?? 'Inconnu' },
  { key: 'reason', label: 'Motif', format: (r: UserAuditRow) => r.reason || '—' },
]

/** Liens vers les écrans existants ; null quand aucun lien n'existe. */
export const parcelLink = (r: UserParcelRow): string => `/colis?open=${r.id}`
export const tripLink = (r: UserTripRow): string => `/colis?tab=announcements&announcement=${r.id}`
export const requestLink = (r: UserRequestRow): string => `/colis?tab=demandes&open=${r.id}`
export const paymentLink = (r: UserPaymentRow): string => `/transactions?open=${r.id}`
export const disputeLink = (r: UserDisputeRow): string => `/incidents?open=${r.id}`
export const reportLink = (r: UserReportRow): string => `/signalements?open=${r.id}`
