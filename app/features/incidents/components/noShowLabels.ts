import type { AdminNoShow, NoShowDecision, NoShowParty, NoShowPartyRole, NoShowScope, NoShowStatus, NoShowTrip } from '@/features/incidents/types/index'
import { formatMajorAmount } from '@/features/finance/types/index'
import { paymentMethodsLabel } from '@/features/package-requests/labels'
import { paymentStatusMeta } from '@/features/payments/components/paymentStatus'
import { bidStatusMeta } from '@/features/bids/components/bidStatus'
import type { PaymentStatus } from '@/features/payments/types/index'
import type { BidStatus } from '@/features/bids/types/index'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const SUBJECT: Record<NoShowPartyRole, string> = { TRAVELER: 'Le voyageur', SENDER: 'L’expéditeur', RECIPIENT: 'Le destinataire' }
const OBJECT: Record<NoShowPartyRole, string> = { TRAVELER: 'le voyageur', SENDER: 'l’expéditeur', RECIPIENT: 'le destinataire' }
const ROLE: Record<NoShowPartyRole, string> = { TRAVELER: 'Voyageur', SENDER: 'Expéditeur', RECIPIENT: 'Destinataire' }

const cleanName = (p: NoShowParty) => p.name?.trim() || null
const withName = (label: string, p: NoShowParty) => (cleanName(p) ? `${label} ${cleanName(p)}` : label)

/** Portée réelle, ou déduite du motif pour l'ancien back (seul SENDER_NO_SHOW se déclare à la remise). */
function momentOf(row: AdminNoShow): NoShowScope {
  if (row.scope) return row.scope
  return row.reason === 'SENDER_NO_SHOW' ? 'HANDOVER' : 'DELIVERY'
}
const MOMENT: Record<NoShowScope, string> = { HANDOVER: 'à la remise', DELIVERY: 'à la livraison' }

/** « Le voyageur Awa D. déclare l’expéditeur Moussa K. absent à la remise ». */
export function noShowSentence(row: AdminNoShow): string {
  const moment = MOMENT[momentOf(row)]
  const { declarant, accused } = row
  if (declarant && accused) return `${withName(SUBJECT[declarant.role], declarant)} déclare ${withName(OBJECT[accused.role], accused)} absent ${moment}`
  if (declarant) return `${withName(SUBJECT[declarant.role], declarant)} déclare une absence ${moment}`
  if (accused) return `Absence déclarée de ${withName(OBJECT[accused.role], accused)} ${moment}`
  return `Absence déclarée ${moment}`
}

export function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

/** Titre d'une ligne : la phrase, ou le colis abrégé quand l'ancien back ne donne pas les noms. */
export function noShowTitle(row: AdminNoShow): string {
  return row.legacy ? `Colis ${shortId(row.bidId)}` : noShowSentence(row)
}

export function scopeMeta(scope: NoShowScope): { label: string; tone: Tone } {
  return scope === 'HANDOVER' ? { label: 'Départ', tone: 'info' } : { label: 'Arrivée', tone: 'warning' }
}

const STATUS: Record<NoShowStatus, { label: string; tone: Tone }> = {
  PENDING_CONFIRMATION: { label: 'En attente', tone: 'warning' },
  CONTESTED: { label: 'Contesté', tone: 'danger' },
  CONFIRMED: { label: 'Absence confirmée', tone: 'neutral' },
  RESOLVED: { label: 'Résolu', tone: 'success' },
}
export function noShowStatusMeta(status: NoShowStatus): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: status, tone: 'neutral' }
}

export function disputeLinkLabel(dispute: { id: string; status: string }): string {
  if (dispute.status === 'OPEN') return 'Litige ouvert'
  if (dispute.status === 'RESOLVED') return 'Litige résolu'
  return 'Litige lié'
}
export const disputeHref = (dispute: { id: string }) => `/incidents?tab=disputes&open=${dispute.id}`

const MINUTE = 60_000
/**
 * Temps laissé à la partie mise en cause pour répondre, seulement tant qu'on attend sa réponse.
 * `remainingMinutes` du back prime ; sinon calculé depuis l'échéance.
 */
export function remainingMeta(row: AdminNoShow, now: number = Date.now()): { label: string; urgent: boolean } | null {
  if (row.status !== 'PENDING_CONFIRMATION') return null
  let minutes = row.remainingMinutes
  if (minutes == null) {
    if (!row.contestationDeadline) return null
    const t = Date.parse(row.contestationDeadline)
    if (Number.isNaN(t)) return null
    minutes = Math.floor((t - now) / MINUTE)
  }
  if (minutes <= 0) return { label: 'échu', urgent: true }
  const urgent = minutes < 120
  if (minutes < 60) return { label: `reste ${minutes} min`, urgent }
  if (minutes < 48 * 60) return { label: `reste ${Math.floor(minutes / 60)} h`, urgent }
  return { label: `reste ${Math.floor(minutes / 1440)} j`, urgent }
}

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayMonthParis = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })
const hourParis = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

/** « Bamako → Abidjan, 15 sept. » ; la date de départ est une date sans heure (lue en UTC). */
export function tripLabel(trip: NoShowTrip | null | undefined): string | null {
  if (!trip || (!trip.departureCity && !trip.arrivalCity)) return null
  const route = `${trip.departureCity ?? '?'} → ${trip.arrivalCity ?? '?'}`
  const t = trip.departureDate ? Date.parse(trip.departureDate.length === 10 ? `${trip.departureDate}T00:00:00Z` : trip.departureDate) : NaN
  return Number.isNaN(t) ? route : `${route}, ${dayMonth.format(t)}`
}

/** « 15 sept. à 14:30 », heure de Paris. */
export function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return `${dayMonthParis.format(t)} à ${hourParis.format(t)}`
}

export function amountLabel(row: AdminNoShow): string | null {
  const parts: string[] = []
  if (row.amount != null) parts.push(formatMajorAmount(row.amount, row.currency))
  if (row.paymentMethod) parts.push(paymentMethodsLabel([row.paymentMethod]))
  return parts.length ? parts.join(' · ') : null
}

export function paymentStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null
  return paymentStatusMeta(status as PaymentStatus)?.label ?? status
}
export function bidStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null
  return bidStatusMeta(status as BidStatus)?.label ?? status
}

export const partyRoleLabel = (role: NoShowPartyRole) => ROLE[role]
export const partyLabel = (p: NoShowParty) => cleanName(p) ?? 'Nom inconnu'

const NOTIFIED = 'Les deux parties sont prévenues de la décision, sans le motif interne.'

/** Ce que la décision va déclencher, pour le dialogue de confirmation. */
export function decisionEffect(row: AdminNoShow, decision: NoShowDecision): string[] {
  if (row.legacy) {
    return ['Le serveur n’est pas encore à jour : cette action confirme l’absence de l’expéditeur, le colis est annulé et l’expéditeur remboursé.']
  }
  if (decision === 'reject') return ['La déclaration est classée et le colis continue normalement.', NOTIFIED]
  if (momentOf(row) === 'DELIVERY') return ['Un litige est ouvert, à trancher ensuite dans l’onglet Litiges.', NOTIFIED]
  const lines = ['Le colis est annulé et l’expéditeur remboursé.']
  if (row.paymentMethod === 'CASH') lines.push('Paiement en espèces : la commission est remboursée au voyageur.')
  lines.push(NOTIFIED)
  return lines
}

export function decisionSuccess(row: AdminNoShow, decision: NoShowDecision): string {
  if (row.legacy) return 'Absence confirmée.'
  if (decision === 'reject') return 'Déclaration rejetée. Le colis continue normalement et les deux parties sont prévenues.'
  if (momentOf(row) === 'DELIVERY') return 'Absence confirmée. Litige ouvert : tranchez-le dans l’onglet Litiges.'
  return 'Absence confirmée. Le colis est annulé, l’expéditeur remboursé et les deux parties sont prévenues.'
}
