import { readFilters, writeFilters, type FilterSpecs } from '@/lib/urlFilters'
import type { MobileMoneyCounts, MobileMoneyOperationKind, MobileMoneyView } from '@/features/finance/types/index'
import type { FinanceViewDef } from './financeViews'

/**
 * Vues de la liste des opérations mobile money. Le nombre de « Échecs » est celui des opérations
 * en échec (`failed`) ; le rouge suit `attention` (échecs, 3DS à finir, remboursements en échec).
 */
export const MOBILE_MONEY_VIEWS: FinanceViewDef<MobileMoneyView>[] = [
  { id: 'FAILED', label: 'Échecs', countKey: 'failed', alert: true, alertKey: 'attention' },
  { id: 'OPEN', label: 'En cours', countKey: 'open' },
  { id: 'DONE', label: 'Réussies', countKey: 'done' },
  { id: 'ALL', label: 'Toutes', countKey: 'all' },
]

/** Vue d'ouverture : les échecs s'il y en a à traiter, sinon tout. Sans nombres (ancien back) : tout. */
export function defaultMobileMoneyView(counts: MobileMoneyCounts | null): MobileMoneyView {
  return counts && counts.attention > 0 ? 'FAILED' : 'ALL'
}

export const MOBILE_MONEY_KIND_OPTIONS: { value: MobileMoneyOperationKind | ''; label: string }[] = [
  { value: '', label: 'Tous les types' },
  { value: 'DEPOSIT', label: 'Dépôt' },
  { value: 'PAYOUT', label: 'Versement' },
  { value: 'REFUND', label: 'Remboursement' },
]

/** Paramètres d'URL propres à la section : à retirer quand on la quitte. */
export const MM_URL_PARAMS = ['view', 'kind', 'provider', 'query'] as const
type MmKey = typeof MM_URL_PARAMS[number]

const VIEWS_IN_URL = MOBILE_MONEY_VIEWS.map(v => v.id.toLowerCase())
const PROVIDER = /^[A-Z0-9_]{2,40}$/

const SPECS: FilterSpecs<MmKey> = {
  view: { default: '', allowed: VIEWS_IN_URL },
  kind: { default: '', allowed: ['DEPOSIT', 'PAYOUT', 'REFUND'] },
  provider: { default: '' },
  query: { default: '' },
}

export interface MobileMoneyUrlState {
  view?: MobileMoneyView
  kind?: MobileMoneyOperationKind
  provider?: string
  query?: string
}

/** Filtres lus dans l'URL (`view` en minuscules, majuscules tolérées) ; le reste est ignoré. */
export function readMobileMoneyQuery(query: Record<string, unknown> | undefined): MobileMoneyUrlState {
  const q = { ...(query ?? {}) }
  if (typeof q.view === 'string') q.view = q.view.toLowerCase()
  const found = readFilters(q, SPECS)
  const out: MobileMoneyUrlState = {}
  if (typeof found.view === 'string') out.view = found.view.toUpperCase() as MobileMoneyView
  if (typeof found.kind === 'string') out.kind = found.kind as MobileMoneyOperationKind
  if (typeof found.provider === 'string' && PROVIDER.test(found.provider)) out.provider = found.provider
  if (typeof found.query === 'string' && found.query.trim()) out.query = found.query
  return out
}

/** `query` complétée des filtres ; la vue n'est écrite que si les nombres existent (`withView`). */
export function writeMobileMoneyQuery(
  query: Record<string, unknown> | undefined,
  state: { view: MobileMoneyView; kind: string; provider: string; query: string },
  withView: boolean,
): Record<string, unknown> {
  return writeFilters(query, {
    view: withView ? state.view.toLowerCase() : '', kind: state.kind, provider: state.provider, query: state.query.trim(),
  }, SPECS)
}
