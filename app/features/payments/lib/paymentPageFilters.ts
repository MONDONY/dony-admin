import { PAYMENT_ALERTS, PAYMENT_VIEWS, defaultPaymentViewFor } from './paymentViews'
import { shortId } from './paymentLabels'
import { readFilters, type FilterSpecs, type FilterValue } from '@/lib/urlFilters'
import { isUuid } from '@/lib/safeInput'
import type { PaymentsFilterState, PaymentView } from '../types/index'

/**
 * Montant saisi en unités principales (« 100 », « 12,5 », « 12.5 ») → centimes ; `null` si
 * vide ou invalide (négatif, plus de deux décimales, texte).
 */
export function toCents(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null
  const v = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null
  return Math.round(Number(v) * 100)
}

/** Centimes → unités principales pour l'URL (`10000` → « 100 », `1250` → « 12.5 ») ; vide si absent. */
export function fromCents(cents: number | null | undefined): string {
  if (cents == null) return ''
  return String(cents / 100)
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', ESCROW: 'En séquestre', RELEASED: 'Libéré', FAILED: 'Échoué', REFUNDED: 'Remboursé', CANCELLED: 'Annulé',
}
const PAYMENT_METHOD_LABELS: Record<string, string> = { STRIPE: 'Carte', PAWAPAY: 'Mobile money' }

export type PaymentUrlKey = 'status' | 'method' | 'currency' | 'dateFrom' | 'dateTo' | 'hideAbandoned' | 'view' | 'alert'
  | 'partyId' | 'announcementId' | 'bidId' | 'query' | 'amountMin' | 'amountMax'

/**
 * Filtres de la page Transactions dans l'URL. Les six premiers gardent leurs clés, défauts et
 * valeurs permises d'avant la réorganisation. `amountMin`/`amountMax` sont des chaînes en unités
 * principales (le modèle de filtres les porte en centimes : `toCents`/`fromCents` font le pont).
 * Les UUID ne se valident pas ici (`FilterSpec` n'a pas de validateur) : lire avec `readPaymentFilters`.
 */
export const PAYMENT_URL_SPECS: FilterSpecs<PaymentUrlKey> = {
  status: { default: 'TOUS', allowed: ['TOUS', 'PENDING', 'ESCROW', 'RELEASED', 'FAILED', 'REFUNDED', 'CANCELLED'] },
  method: { default: 'TOUS', allowed: ['TOUS', 'STRIPE', 'PAWAPAY'] },
  currency: { default: 'TOUTES', allowed: ['TOUTES', 'EUR', 'USD', 'CAD', 'GBP', 'CHF', 'XOF', 'XAF'] },
  dateFrom: { default: null },
  dateTo: { default: null },
  hideAbandoned: { default: true },
  // « À traiter » sans autre filtre (non écrit), « Tous » dès qu'un filtre est présent.
  view: { default: 'ATTENTION', allowed: PAYMENT_VIEWS.map(v => v.id), defaultFrom: defaultPaymentViewFor },
  alert: { default: null, allowed: Object.keys(PAYMENT_ALERTS) },
  partyId: { default: '' },
  announcementId: { default: '' },
  bidId: { default: '' },
  query: { default: '', param: 'query' },
  amountMin: { default: '' },
  amountMax: { default: '' },
}

/** Lecture de l'URL : `readFilters` puis rejet des UUID mal formés et des montants invalides. */
export function readPaymentFilters(query: Record<string, unknown> | undefined): Partial<Record<PaymentUrlKey, FilterValue>> {
  const found = readFilters(query, PAYMENT_URL_SPECS)
  for (const k of ['partyId', 'announcementId', 'bidId'] as const) {
    if (k in found && !isUuid(found[k])) delete found[k]
  }
  for (const k of ['amountMin', 'amountMax'] as const) {
    if (k in found && toCents(found[k] as string) === null) delete found[k]
  }
  return found
}

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

/**
 * Ancien lien `?held=true` → `?view=ATTENTION&alert=HELD` (`held` disparaît). Une `view` ou une
 * `alert` déjà présentes ne sont jamais écrasées.
 */
export function legacyHeldToFilters(query: Record<string, unknown>): Record<string, unknown> {
  if (first(query.held) !== 'true') return query
  const rest = { ...query }
  delete rest.held
  return { ...rest, view: rest.view ?? 'ATTENTION', alert: rest.alert ?? 'HELD' }
}

/**
 * Vue d'ouverture d'après les paramètres **valides** de l'URL : `?status=PIRATE` ou un `partyId`
 * qui n'est pas un UUID ne font pas passer à « Tous ». `?held=true` donne « À traiter » + alerte.
 */
export function paymentInitialView(query: Record<string, unknown>): PaymentView {
  const found = readPaymentFilters(legacyHeldToFilters(query))
  if (found.view) return found.view as PaymentView
  const valid: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(found)) {
    if (k !== 'view' && v !== PAYMENT_URL_SPECS[k as PaymentUrlKey].default && v !== '') valid[k] = v
  }
  return defaultPaymentViewFor(valid)
}

/**
 * État des filtres lu dans l'URL, prêt à copier dans `filters` : `?held=true` converti, UUID et
 * montants vérifiés, montants en centimes, vue d'ouverture calculée sur les paramètres valides.
 */
export function paymentStateFromQuery(query: Record<string, unknown>): Partial<PaymentsFilterState> {
  const found = readPaymentFilters(legacyHeldToFilters(query))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(found)) {
    out[k] = k === 'amountMin' || k === 'amountMax' ? toCents(v as string) : v
  }
  out.view = paymentInitialView(query)
  return out as Partial<PaymentsFilterState>
}

/**
 * Valeurs à écrire dans l'URL, lues à chaque accès sur `filters` (donc réactives) : montants en
 * unités principales, champs absents ramenés à leur défaut (vue absente = « Tous »).
 */
export function paymentUrlValues(f: PaymentsFilterState): Record<PaymentUrlKey, FilterValue> {
  const read: Record<PaymentUrlKey, () => FilterValue> = {
    status: () => f.status, method: () => f.method, currency: () => f.currency,
    dateFrom: () => f.dateFrom, dateTo: () => f.dateTo, hideAbandoned: () => !!f.hideAbandoned,
    view: () => f.view ?? 'ALL', alert: () => f.alert ?? null,
    partyId: () => f.partyId ?? '', announcementId: () => f.announcementId ?? '', bidId: () => f.bidId ?? '',
    query: () => f.query ?? '', amountMin: () => fromCents(f.amountMin), amountMax: () => fromCents(f.amountMax),
  }
  const values = {} as Record<PaymentUrlKey, FilterValue>
  for (const [k, get] of Object.entries(read)) Object.defineProperty(values, k, { enumerable: true, get })
  return values
}

export type PaymentChipKey = 'party' | 'trip' | 'bid' | 'alert' | 'status' | 'method' | 'currency' | 'amount' | 'period' | 'search'
export interface PaymentChip { key: PaymentChipKey; label: string }
/** Noms à afficher, fournis par la page (les filtres ne portent que des identifiants). */
export interface PaymentChipLabels { party?: string; trip?: string; bid?: string }

/** `2026-10-01` → `01/10`. */
function shortDay(d: string): string {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

function periodLabel(from: string | null, to: string | null): string {
  if (from && to) return `${shortDay(from)} → ${shortDay(to)}`
  return from ? `depuis le ${shortDay(from)}` : `jusqu’au ${shortDay(to!)}`
}

function amountLabel(min: number | null | undefined, max: number | null | undefined, currency: string): string {
  const unit = currency === 'TOUTES' || currency === 'EUR' ? '€' : currency
  const n = (c: number) => fromCents(c).replace('.', ',')
  if (min != null && max != null) return `${n(min)} – ${n(max)} ${unit}`
  return min != null ? `≥ ${n(min)} ${unit}` : `≤ ${n(max!)} ${unit}`
}

/**
 * Puces des filtres actifs, chacune retirable, dans l'ordre Personne, Trajet, Colis, Alerte,
 * Statut, Méthode, Devise, Montant, Période, Recherche. La vue et « masquer les abandonnés »
 * n'en font pas : ils ont déjà leur pastille et leur interrupteur.
 */
export function paymentActiveChips(f: PaymentsFilterState, labels: PaymentChipLabels): PaymentChip[] {
  const chips: PaymentChip[] = []
  if (f.partyId) chips.push({ key: 'party', label: `Personne : ${labels.party || shortId(f.partyId)}` })
  if (f.announcementId) chips.push({ key: 'trip', label: `Trajet : ${labels.trip || shortId(f.announcementId)}` })
  if (f.bidId) chips.push({ key: 'bid', label: `Colis : ${labels.bid || shortId(f.bidId)}` })
  if (f.alert) chips.push({ key: 'alert', label: `Alerte : ${PAYMENT_ALERTS[f.alert].label}` })
  if (f.status !== 'TOUS') chips.push({ key: 'status', label: `Statut : ${PAYMENT_STATUS_LABELS[f.status] ?? f.status}` })
  if (f.method !== 'TOUS') chips.push({ key: 'method', label: `Méthode : ${PAYMENT_METHOD_LABELS[f.method] ?? f.method}` })
  if (f.currency !== 'TOUTES') chips.push({ key: 'currency', label: `Devise : ${f.currency}` })
  if (f.amountMin != null || f.amountMax != null) chips.push({ key: 'amount', label: `Montant : ${amountLabel(f.amountMin, f.amountMax, f.currency)}` })
  if (f.dateFrom || f.dateTo) chips.push({ key: 'period', label: `Période : ${periodLabel(f.dateFrom, f.dateTo)}` })
  const q = f.query?.trim()
  if (q) chips.push({ key: 'search', label: `Recherche : ${q}` })
  return chips
}
