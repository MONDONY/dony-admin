/**
 * Grilles de commission par paliers (onglet Tarification), contrat de yadony-back #591
 * (`AdminCommissionGridController`). Les montants arrivent en nombres JSON (BigDecimal Jackson) ;
 * les taux en FRACTION (`0.07`), jamais en pourcentage : l'écran convertit à ses bords.
 * Les dates sont des `LocalDateTime` UTC sans fuseau (voir `utils/parisTime.ts`).
 */

/** Devises de `SupportedCurrency`, dans l'ordre de l'enum (celui des réponses du back). */
export const COMMISSION_CURRENCIES = ['EUR', 'XOF', 'XAF', 'USD', 'CAD', 'GBP', 'CHF'] as const
export type CommissionCurrency = typeof COMMISSION_CURRENCIES[number]

/** Nombre JSON, ou chaîne si un proxy l'a sérialisé ainsi : toujours relu avec `Number()`. */
export type Decimal = number | string

export interface CommissionTier {
  fromEur: Decimal
  rate: Decimal
}

/** Avertissement à acquitter : seule valeur connue, `INCREASE_WITHIN_30_DAYS`. */
export type CommissionGridWarning = string
export const INCREASE_WARNING = 'INCREASE_WITHIN_30_DAYS'

/**
 * Grille vue par l'admin. `note`, `createdBy`, `createdAt`, `cancelledAt` ne sont servis que dans
 * l'historique ; `warnings` que dans la réponse à une programmation (champs nuls omis).
 */
export interface CommissionGrid {
  id: string
  effectiveFrom: string
  tiers: CommissionTier[]
  minimums: Partial<Record<CommissionCurrency, Decimal>>
  note?: string | null
  createdBy?: string | null
  createdAt?: string | null
  cancelledAt?: string | null
  warnings?: CommissionGridWarning[] | null
}

/** `PageResponse` du back (et non le `Page` Spring brut) : `page`, pas `number`. */
export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface CommissionGridList {
  current?: CommissionGrid | null
  scheduled?: CommissionGrid | null
  history: PageResponse<CommissionGrid>
}

/** Corps de `POST /admin/commission-grids` (et brouillon de la simulation). */
export interface CommissionGridRequest {
  tiers: { fromEur: number | null; rate: number | null }[]
  minimums: Record<string, string | null>
  /** UTC sans fuseau ; `null` = effet immédiat. */
  effectiveFrom: string | null
  note: string | null
  acknowledgedWarnings: CommissionGridWarning[]
}

export const RAILS = [
  'CARD_STANDARD', 'CARD_PREMIUM', 'CARD_INTERNATIONAL', 'MOBILE_MONEY_WORST', 'MOBILE_MONEY_BEST', 'CASH',
] as const
export type Rail = typeof RAILS[number]

export const RAIL_LABELS: Record<Rail, string> = {
  CARD_STANDARD: 'Carte européenne standard',
  CARD_PREMIUM: 'Carte premium ou professionnelle',
  CARD_INTERNATIONAL: 'Carte hors Europe',
  MOBILE_MONEY_WORST: 'Mobile money (opérateur le plus cher)',
  MOBILE_MONEY_BEST: 'Mobile money (opérateur le moins cher)',
  CASH: 'Espèces (commission prélevée sur le solde)',
}

export interface SimulationRow {
  net: Decimal
  current: { commission: Decimal; gross: Decimal }
  draft: { commission: Decimal; gross: Decimal; minimumApplied: boolean }
  rails: { rail: Rail; providerCost: Decimal; marginExVat: Decimal }[]
}

export interface SimulationResponse {
  rows: SimulationRow[]
  warnings: CommissionGridWarning[]
  connectActiveAccountMonthly: Decimal
}

/** Une grille brouillon OU une grille existante (`gridId`), jamais les deux. */
export interface SimulationRequest {
  draft?: CommissionGridRequest
  gridId?: string
  currency: CommissionCurrency
  nets: number[]
  vatRatePercent?: number
}

/** Ligne de l'éditeur : saisies en texte brut, taux en POURCENTAGE. */
export interface TierDraft {
  fromEur: string
  ratePercent: string
}

export interface GridDraft {
  tiers: TierDraft[]
  minimums: Record<CommissionCurrency, string>
  /** Valeur d'un `<input type="datetime-local">`, en heure de Paris ; vide = immédiat. */
  effectiveFromParis: string
  note: string
}

export const MAX_TIERS = 10

/** Grille proposée quand aucune n'est en vigueur (spec 2026-10-18). */
export const DEFAULT_TIERS: TierDraft[] = [
  { fromEur: '0', ratePercent: '7' },
  { fromEur: '100', ratePercent: '6' },
  { fromEur: '300', ratePercent: '5' },
]

/** Minimums par défaut, miroir de `CommissionGridService.defaultMinimums()`. */
export const DEFAULT_MINIMUMS: Record<CommissionCurrency, string> = {
  EUR: '1.00', XOF: '650', XAF: '650', USD: '1.10', CAD: '1.50', GBP: '0.90', CHF: '0.95',
}

/** Nets comparés sous l'éditeur, en euros. */
export const COMPARISON_NETS = [5, 10, 20, 50, 100, 200, 300, 500] as const

/** Parité fixe du franc CFA : 655,957 FCFA pour 1 € (traité monétaire, pas un taux de marché). */
export const CFA_PER_EUR = 655.957

export const COMMISSION_GRID_UNAVAILABLE = 'Fonctionnalité disponible après la mise à jour du serveur.'

export type GridState = 'current' | 'scheduled' | 'past' | 'cancelled'
export const GRID_STATE_LABELS: Record<GridState, string> = {
  current: 'En vigueur',
  scheduled: 'Programmée',
  past: 'Passée',
  cancelled: 'Annulée',
}
