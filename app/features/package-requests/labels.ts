import { paymentMethodLabel } from '@/features/payments/types/index'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'
type Meta = { label: string; tone: Tone }

const STATUS: Record<string, Meta> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  OPEN: { label: 'Ouverte', tone: 'success' },
  NEGOTIATING: { label: 'En négociation', tone: 'info' },
  ACCEPTED: { label: 'Acceptée', tone: 'info' },
  EXPIRED: { label: 'Expirée', tone: 'neutral' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
  COMPLETED: { label: 'Terminée', tone: 'success' },
  REMOVED_BY_ADMIN: { label: 'Retirée', tone: 'danger' },
}

/** Statut inconnu (ajouté côté back avant le front) : affiché brut, ton neutre. */
export function packageRequestStatusMeta(status: string): Meta {
  return STATUS[status] ?? { label: status, tone: 'neutral' }
}

/** Miroir de `NegotiationThreadStatus` (yadony-back). */
const NEGOTIATION: Record<string, Meta> = {
  OPEN: { label: 'En cours', tone: 'info' },
  AWAITING_TRIP: { label: 'Attente du trajet', tone: 'info' },
  AWAITING_PAYMENT: { label: 'Attente du paiement', tone: 'info' },
  AWAITING_COMMISSION: { label: 'Attente de la commission', tone: 'info' },
  AWAITING_DEPOSIT: { label: 'Dépôt mobile money en cours', tone: 'info' },
  ACCEPTED: { label: 'Acceptée', tone: 'success' },
  REJECTED: { label: 'Refusée', tone: 'neutral' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
  AUTO_REJECTED: { label: 'Écartée (autre offre retenue)', tone: 'neutral' },
  EXPIRED: { label: 'Expirée', tone: 'neutral' },
}
const ACTIVE_NEGOTIATIONS = new Set(['OPEN', 'AWAITING_TRIP', 'AWAITING_PAYMENT', 'AWAITING_COMMISSION', 'AWAITING_DEPOSIT'])

export function negotiationStatusMeta(status: string): Meta {
  return NEGOTIATION[status] ?? { label: status, tone: 'neutral' }
}
export function isActiveNegotiation(status: string): boolean {
  return ACTIVE_NEGOTIATIONS.has(status)
}

/**
 * Le code de `removeBlockedReason` n'est pas encore figé côté back : on accepte la forme
 * slug (`package-request-has-active-shipment`) comme la forme enum (`HAS_ACTIVE_SHIPMENT`).
 */
function normalizeBlockCode(code: string): string {
  return code.toLowerCase().replace(/_/g, '-').replace(/^package-request-/, '')
}

export function isActiveShipmentBlock(code: string | null): boolean {
  if (!code) return false
  const c = normalizeBlockCode(code)
  return c === 'has-active-shipment' || c === 'active-shipment'
}

export function removeBlockedExplanation(code: string | null): string {
  if (!code) return 'Retrait impossible pour le moment.'
  if (isActiveShipmentBlock(code)) {
    return 'Un envoi est en cours sur cette demande (colis accepté, payé ou en route) : elle ne peut plus être retirée. Traitez le problème depuis les litiges.'
  }
  if (normalizeBlockCode(code) === 'already-removed') return 'Cette demande est déjà retirée.'
  return `Retrait impossible pour le moment (${code}).`
}

const PARCEL_SIZE: Record<string, string> = {
  SMALL: 'Petit (5 kg max)',
  MEDIUM: 'Moyen (5 à 15 kg)',
  LARGE: 'Grand (plus de 15 kg)',
}
export function parcelSizeLabel(size: string | null): string {
  if (!size) return 'Non renseignée'
  return PARCEL_SIZE[size] ?? size
}

const TRANSPORT: Record<string, string> = {
  PLANE: 'Avion', CAR: 'Voiture', TRAIN: 'Train', BUS: 'Car', BOAT: 'Bateau', OTHER: 'Autre',
}
export function transportModeLabel(mode: string | null): string {
  if (!mode) return 'Indifférent'
  return TRANSPORT[mode] ?? mode
}

const EXTRA_PAYMENT: Record<string, string> = { CASH: 'Espèces', WALLET: 'Portefeuille' }
export function paymentMethodsLabel(methods: string[] | null | undefined): string {
  if (!methods?.length) return 'Non renseignés'
  return methods.map((m) => EXTRA_PAYMENT[m] ?? paymentMethodLabel(m)).join(', ')
}
