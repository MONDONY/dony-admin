import { timelineActionLabel } from '@/features/payments/lib/paymentLabels'
import { parseServerDate } from '@/lib/serverDate'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'
type Meta = { label: string; tone: Tone }

/** Code inconnu : rendu lisible (`SOME_CODE` → « Some code »). */
function humanize(code: string): string {
  const words = code.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Étapes de la chronologie d'un colis : scans, journal d'audit du colis et des entités liées,
 * dates portées par ces entités. Les codes de paiement passent par les libellés de la fiche paiement.
 */
const TIMELINE: Record<string, string> = {
  BID_CREATED: 'Demande de colis créée',
  CREATED_FROM_THREAD: 'Colis créé depuis la négociation',
  BID_ACCEPTED: 'Accepté par le voyageur',
  MM_BID_ACCEPTED_AWAITING_PAYMENT: 'Accepté, en attente du paiement mobile money',
  PRESENCE_CONFIRMED: 'Présence confirmée par le voyageur',
  BID_REJECTED: 'Refusé par le voyageur',
  BID_CANCELLED: 'Colis annulé',
  BID_CANCELLED_AFTER_HANDOVER: 'Annulé après la remise',
  BID_AUTO_CANCELLED_TIMEOUT: 'Annulé automatiquement (délai dépassé)',
  BID_NO_SHOW: 'Absence signalée au rendez-vous',
  BID_EXPIRED_ON_DEPARTURE: 'Expiré au départ du voyageur',
  BID_ABANDONED_UNPAID_CARD: 'Abandonné : carte jamais payée',
  BID_HIDDEN_BY_SENDER: 'Masqué par l’expéditeur',
  BID_DISMISSED_BY_TRAVELER: 'Écarté par le voyageur',
  BID_NEGOTIATION_PROPOSED: 'Prix proposé',
  BID_NEGOTIATION_COUNTERED: 'Contre-proposition de prix',
  BID_NEGOTIATION_ACCEPTED: 'Prix accepté',
  BID_NEGOTIATION_CHECKOUT: 'Paiement de la négociation lancé',
  BID_NEGOTIATION_EXPIRED: 'Négociation expirée',
  BID_NEGOTIATION_HIDDEN: 'Négociation masquée',
  BID_NEGOTIATION_ARCHIVED: 'Négociation archivée',
  BID_NEGOTIATION_UNARCHIVED: 'Négociation désarchivée',
  CONTACT_PHONE_REVEALED: 'Numéro de téléphone dévoilé',
  RECIPIENT_CHANGED: 'Destinataire modifié',
  RECIPIENT_REPLACEMENT_REQUESTED: 'Changement de destinataire demandé',
  RETURN_CODE_GENERATED: 'Code de retour généré',
  PARCEL_RETURNED: 'Colis rendu à l’expéditeur',
  DELIVERY_NOSHOW_REPORTED_BY_TRAVELER: 'Destinataire absent (signalé par le voyageur)',
  DELIVERY_NOSHOW_REPORTED_BY_SENDER: 'Voyageur absent à la livraison (signalé par l’expéditeur)',
  TRAVELER_NO_SHOW_REPORTED: 'Absence du voyageur signalée',
  TRIP_RESCHEDULE_KEPT: 'Trajet reporté, colis maintenu',
  TRIP_RESCHEDULE_WITHDRAWN: 'Trajet reporté, colis retiré',
  MM_PAYMENT_EXPIRED: 'Paiement mobile money expiré',
  CODE_GENERATED: 'Code de remise généré',
  CODE_REFRESHED: 'Code de remise renouvelé',
  CODE_PUBLIC_ENABLED: 'Code de remise partagé avec le destinataire',
  CODE_PUBLIC_DISABLED: 'Partage du code de remise retiré',
  RECETTE_DELIVERY_BEFORE_DEPARTURE: 'Recette : livraison avant le départ',
  RECETTE_SELF_RECIPIENT_LINKED: 'Recette : destinataire lié à soi-même',
  DEPART: 'Scan de départ',
  TRANSIT: 'Scan en transit',
  ARRIVEE: 'Scan d’arrivée',
  SCAN: 'Scan',
  DELIVERY_CONFIRMED: 'Livraison confirmée (code de remise)',
  DELIVERED: 'Livré',
  DISPUTE_OPENED: 'Litige ouvert',
  DELIVERY_NOSHOW_DISPUTE_OPENED: 'Litige ouvert (absence à la livraison)',
  DISPUTE_RESOLVED: 'Litige résolu',
  RESOLVE: 'Litige résolu par un admin',
  CANCELLATION_CREATED: 'Annulation enregistrée',
  DELIVERY_NOSHOW_CONTESTED: 'Absence contestée',
  ADMIN_BID_CANCELLED: 'Colis annulé par un admin',
  ADMIN_DISPUTE_OPENED: 'Litige ouvert par un admin',
  NOSHOW_CONFIRMED_BY_ADMIN: 'Absence confirmée par un admin',
  NOSHOW_REJECTED_BY_ADMIN: 'Absence rejetée par un admin',
  RATING_CREATED: 'Notation laissée',
  TRAVELER_RATING_CREATED: 'Voyageur noté',
  RECEPTION_RATING_CREATED: 'Notation du destinataire',
  FRAUD_ALERT_RATING_FARMING: 'Alerte : notations suspectes',
  CONVERSATION_CREATED: 'Conversation ouverte',
}

export function bidTimelineLabel(code: string): string {
  if (TIMELINE[code]) return TIMELINE[code]
  // Paiements : même vocabulaire que la fiche paiement (dont le repli lisible).
  return timelineActionLabel(code)
}

/** Couleur du repère : argent, scans, incidents, le reste. */
export function bidTimelineTone(kind: string, code: string): Tone {
  if (/DISPUTE|NO_?SHOW|CANCEL|REJECT|EXPIRED|ABANDONED|FRAUD|FAILED|REFUSED/.test(code)) return 'danger'
  if (kind === 'PAYMENT') return 'success'
  if (kind === 'SCAN' || code === 'DELIVERED' || code === 'DELIVERY_CONFIRMED') return 'info'
  return 'neutral'
}

const ANNOUNCEMENT: Record<string, Meta> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  ACTIVE: { label: 'Publiée', tone: 'success' },
  FULL: { label: 'Complète', tone: 'info' },
  IN_PROGRESS: { label: 'Voyage en cours', tone: 'info' },
  COMPLETED: { label: 'Terminée', tone: 'neutral' },
  CANCELLED: { label: 'Annulée', tone: 'danger' },
  REMOVED_BY_ADMIN: { label: 'Retirée par un admin', tone: 'danger' },
}
export function announcementStatusMeta(s: string | null | undefined): Meta {
  if (!s) return { label: 'Inconnu', tone: 'neutral' }
  return ANNOUNCEMENT[s] ?? { label: humanize(s), tone: 'neutral' }
}

const TRANSPORT: Record<string, string> = { PLANE: 'Avion', CAR: 'Voiture', BUS: 'Bus', BOAT: 'Bateau', TRAIN: 'Train', OTHER: 'Autre' }
export function transportModeLabel(m: string | null | undefined): string | null {
  if (!m) return null
  return TRANSPORT[m] ?? humanize(m)
}

/** Moyen de paiement du colis (valeurs `bids.payment_method`). */
const BID_PAYMENT: Record<string, string> = {
  STRIPE: 'Carte', CASH: 'Espèces à la remise', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money',
  MOBILE_MONEY: 'Mobile money', PAWAPAY: 'Mobile money',
}
export function bidPaymentMethodLabel(m: string | null | undefined): string {
  if (!m) return '—'
  return BID_PAYMENT[m] ?? humanize(m)
}

const STRIPE: Record<string, string> = {
  NOT_CREATED: 'Aucun compte',
  PENDING_ONBOARDING: 'Inscription Stripe inachevée',
  ONBOARDING_COMPLETE: 'Compte actif',
  REJECTED: 'Refusé par Stripe',
  DISABLED: 'Désactivé',
}
export function stripeAccountLabel(s: string | null | undefined): string {
  if (!s) return 'Aucun compte'
  return STRIPE[s] ?? humanize(s)
}

const MOBILE_MONEY: Record<string, string> = { NOT_CONFIGURED: 'Non configuré', ACTIVE: 'Actif' }
export function mobileMoneyLabel(s: string | null | undefined): string {
  if (!s) return 'Non configuré'
  return MOBILE_MONEY[s] ?? humanize(s)
}

const DISPUTE: Record<string, string> = { OPEN: 'ouvert', RESOLVED: 'résolu', CLOSED: 'clos', IN_REVIEW: 'en examen' }
export function disputeStatusLabel(s: string | null | undefined): string {
  if (!s) return ''
  return DISPUTE[s] ?? s.toLowerCase()
}

const USER_STATUS: Record<string, Meta> = {
  ACTIVE: { label: 'Actif', tone: 'success' },
  SUSPENDED: { label: 'Suspendu', tone: 'warning' },
  BANNED: { label: 'Banni', tone: 'danger' },
  PENDING_DELETION: { label: 'Suppression demandée', tone: 'warning' },
  DELETED: { label: 'Supprimé', tone: 'neutral' },
}
export function userStatusMeta(s: string): Meta {
  return USER_STATUS[s] ?? { label: humanize(s), tone: 'neutral' }
}

/** Nom du pays en français (FR → France) ; le code brut si le navigateur ne sait pas. */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** « Paris (France) » ; la ville seule si le pays manque. */
export function placeLabel(city: string | null | undefined, country: string | null | undefined): string {
  const c = countryName(country)
  if (!city) return c ?? '—'
  return c ? `${city} (${c})` : city
}

/** `2026-10-12` → « lundi 12 octobre 2026 », sans décalage de fuseau. */
export function formatDay(d: string | null | undefined): string | null {
  if (!d) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** `09:30:00` → « 09:30 ». */
export function formatTime(t: string | null | undefined): string | null {
  if (!t) return null
  const m = /^(\d{2}):(\d{2})/.exec(t)
  return m ? `${m[1]}:${m[2]}` : null
}

/** Date et heure du serveur (UTC sans fuseau) en heure locale ; null si illisible. */
export function formatDateTime(d: string | null | undefined): string | null {
  const ms = parseServerDate(d)
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Poids en kilos, sans zéros inutiles. */
export function formatKg(kg: number | null | undefined): string | null {
  if (kg == null) return null
  return `${Number(kg).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`
}
