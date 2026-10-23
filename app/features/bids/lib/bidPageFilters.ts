import { bidStatusMeta } from '../components/bidStatus'
import { bidPaymentMethodLabel } from './bidLabels'
import { BID_ALERTS, BID_VIEWS, defaultViewFor } from './bidViews'
import { readFilters, type FilterSpecs } from '@/lib/urlFilters'
import { uuidParam } from '@/lib/safeInput'
import type { AdminBidSuggest, BidSearchScope, BidsFilterState, BidStatus, BidView } from '../types'

/** Portées de la recherche, dans l'ordre du sélecteur. */
export const BID_SEARCH_SCOPES: { value: BidSearchScope; label: string }[] = [
  { value: 'ALL', label: 'Tout' },
  { value: 'TRACKING', label: 'N° de suivi' },
  { value: 'SENDER', label: 'Expéditeur' },
  { value: 'TRAVELER', label: 'Voyageur' },
  { value: 'RECIPIENT', label: 'Destinataire' },
  { value: 'TRIP', label: 'Trajet' },
]

/** Modes de paiement proposés par le filtre (et seuls acceptés depuis l'URL). */
export const BID_PAYMENT_METHODS = ['STRIPE', 'CASH', 'WAVE', 'ORANGE_MONEY', 'MOBILE_MONEY', 'PAWAPAY']

export type BidChipKey = 'search' | 'status' | 'period' | 'payment' | 'content' | 'alert'
export interface BidChip { key: BidChipKey; label: string }

/** `2026-07-01` → `01/07/2026`. */
function shortDay(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function periodLabel(from: string | null, to: string | null): string {
  if (from && to) return `${shortDay(from)} → ${shortDay(to)}`
  return from ? `depuis le ${shortDay(from)}` : `jusqu’au ${shortDay(to!)}`
}

/**
 * Puces des filtres actifs de l'onglet Colis, chacune retirable. La vue et le focus de trajet
 * n'en font pas : ils ont déjà leur onglet et leur bandeau.
 */
export function bidActiveChips(f: BidsFilterState): BidChip[] {
  const chips: BidChip[] = []
  const q = f.query.trim()
  if (q) {
    const scope = f.scope === 'ALL' ? 'Recherche' : BID_SEARCH_SCOPES.find(s => s.value === f.scope)!.label
    chips.push({ key: 'search', label: `${scope} : ${q}` })
  }
  if (f.status !== 'TOUS') chips.push({ key: 'status', label: `Statut : ${bidStatusMeta(f.status as BidStatus).label}` })
  if (f.dateFrom || f.dateTo) chips.push({ key: 'period', label: `Période : ${periodLabel(f.dateFrom, f.dateTo)}` })
  if (f.paymentMethod) chips.push({ key: 'payment', label: `Paiement : ${bidPaymentMethodLabel(f.paymentMethod)}` })
  if (f.content.trim()) chips.push({ key: 'content', label: `Contenu : ${f.content.trim()}` })
  if (f.alert) chips.push({ key: 'alert', label: `Alerte : ${BID_ALERTS[f.alert].label}` })
  return chips
}

type SuggestionKind = 'sender' | 'traveler' | 'recipient' | 'trip' | 'parcel'
type SuggestionPayload = AdminBidSuggest['senders'][number] | AdminBidSuggest['recipients'][number] | AdminBidSuggest['trips'][number] | AdminBidSuggest['parcels'][number]

/**
 * Suggestion choisie → recherche à portée (expéditeur « Awa Diop » : `query = Awa Diop`,
 * `scope = SENDER`). Un trajet cherche ses deux villes, que le back exige toutes deux.
 * Un colis ne devient pas une recherche : il ouvre sa fiche (null).
 */
export function searchFromSuggestion(kind: SuggestionKind, payload: SuggestionPayload): { query: string; scope: BidSearchScope } | null {
  switch (kind) {
    case 'sender': return { query: (payload as { name: string }).name, scope: 'SENDER' }
    case 'traveler': return { query: (payload as { name: string }).name, scope: 'TRAVELER' }
    case 'recipient': return { query: (payload as { name: string }).name, scope: 'RECIPIENT' }
    case 'trip': {
      const t = payload as AdminBidSuggest['trips'][number]
      const cities = [t.departureCity, t.arrivalCity].filter(Boolean).join(' ')
      return { query: cities || t.label, scope: 'TRIP' }
    }
    default: return null
  }
}

/** Texte validé égal (casse et espaces ignorés) au n° de suivi d'un colis suggéré : son identifiant. */
export function exactParcelId(text: string, suggestions: AdminBidSuggest | null): string | null {
  const wanted = text.trim().toUpperCase()
  if (!wanted || !suggestions) return null
  return suggestions.parcels.find(p => p.trackingNumber?.toUpperCase() === wanted)?.bidId ?? null
}

const STATUS_FILTERS = ['TOUS', 'AWAITING_PAYMENT', 'PENDING', 'PAYMENT_ESCROWED', 'ACCEPTED', 'HANDED_OVER', 'IN_TRANSIT', 'ARRIVED',
  'REJECTED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'PARCEL_REFUSED', 'EXPIRED']

type BidUrlKey = 'status' | 'query' | 'scope' | 'paymentMethod' | 'content' | 'alert' | 'dateFrom' | 'dateTo'
/** Filtres de l'onglet Colis dans l'URL, hors vue (dont le défaut se calcule) et hors trajet (géré par la page). */
export const BID_URL_FILTERS: FilterSpecs<BidUrlKey> = {
  status: { default: 'TOUS', allowed: STATUS_FILTERS },
  query: { default: '' },
  scope: { default: 'ALL', allowed: BID_SEARCH_SCOPES.map(s => s.value) },
  paymentMethod: { default: null, allowed: BID_PAYMENT_METHODS },
  content: { default: '' },
  alert: { default: null, allowed: Object.keys(BID_ALERTS) },
  dateFrom: { default: null },
  dateTo: { default: null },
}
const VIEW_SPEC: FilterSpecs<'view'> = { view: { default: null, allowed: BID_VIEWS.map(v => v.id) } }

/**
 * Vue par défaut d'après les paramètres **valides** de l'URL : `?status=PIRATE` ou un
 * `announcementId` qui n'est pas un UUID ne font pas passer à « Tous ».
 */
export function bidInitialView(query: Record<string, unknown>): BidView {
  const valid: Record<string, unknown> = {}
  const found = readFilters(query, BID_URL_FILTERS)
  for (const [k, v] of Object.entries(found)) {
    if (v !== BID_URL_FILTERS[k as BidUrlKey].default) valid[k] = v
  }
  Object.assign(valid, readFilters(query, VIEW_SPEC))
  const trip = uuidParam(query.announcementId)
  if (trip) valid.announcementId = trip
  return defaultViewFor(valid)
}

/** Liste vide : « À traiter » sans filtre n'a rien à faire ; avec filtres, on le dit et on propose « Tous ». */
export function bidEmptyState(f: BidsFilterState): { label: string; hint: string | undefined; action: string | null } {
  if (f.view !== 'TODO') return { label: 'Aucun colis', hint: undefined, action: null }
  return bidActiveChips(f).length > 0
    ? { label: 'Aucun colis à traiter pour ces filtres.', hint: undefined, action: 'Voir dans Tous' }
    : { label: 'Rien à traiter pour l’instant.', hint: 'Aucun litige, no-show, paiement en attente ni retard.', action: 'Voir tous les colis' }
}

/** Onglets du tiroir qui vont dans `?section=` ; Résumé, onglet par défaut, n'y est jamais écrit. */
export const BID_DRAWER_SECTIONS = ['tracking', 'money', 'chat', 'incidents'] as const
export type BidDrawerSection = typeof BID_DRAWER_SECTIONS[number]
/** `?section=` lu dans l'URL : valeur inconnue, Résumé ou tableau ignorés (`null`). */
export function bidDrawerSection(value: unknown): BidDrawerSection | null {
  return typeof value === 'string' && (BID_DRAWER_SECTIONS as readonly string[]).includes(value) ? value as BidDrawerSection : null
}
