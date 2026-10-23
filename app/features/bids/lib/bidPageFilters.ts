import { bidStatusMeta } from '../components/bidStatus'
import { bidPaymentMethodLabel } from './bidLabels'
import { BID_ALERTS } from './bidViews'
import type { AdminBidSuggest, BidSearchScope, BidsFilterState, BidStatus } from '../types'

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
