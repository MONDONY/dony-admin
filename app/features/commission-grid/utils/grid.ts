import { parseServerDate } from '@/lib/serverDate'
import { parisInputToUtc } from './parisTime'
import {
  COMMISSION_CURRENCIES, DEFAULT_MINIMUMS, DEFAULT_TIERS,
} from '@/features/commission-grid/types/index'
import type {
  CommissionCurrency, CommissionGrid, CommissionGridRequest, CommissionGridWarning, Decimal, GridDraft, GridState,
} from '@/features/commission-grid/types/index'

/**
 * Taux (fraction, `0.07`) → pourcentage affiché (`7`). L'arrondi absorbe le bruit flottant
 * (`0.07 * 100 === 7.000000000000001`) à la MÊME précision que `percentToRate` (6 décimales de
 * fraction = 4 de pourcentage) : `0.07125` se relit `7.125`, jamais `7.13`. Arrondir plus court
 * ferait monter le taux en silence quand on reprogramme une grille « à l'identique ».
 */
export function rateToPercent(rate: Decimal | null | undefined): string {
  const n = Number(rate)
  if (rate === null || rate === undefined || Number.isNaN(n)) return ''
  return String(Math.round(n * 1_000_000) / 10_000)
}

/** Saisie décimale (virgule acceptée) → nombre ; vide ou illisible = `null`. */
export function parseDecimalInput(raw: string | null | undefined): number | null {
  const s = (raw ?? '').trim().replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Pourcentage saisi (`7`) → taux envoyé (`0.07`), arrondi à 6 décimales ; illisible = `null`. */
export function percentToRate(raw: string | null | undefined): number | null {
  const n = parseDecimalInput(raw)
  return n === null ? null : Number((n / 100).toFixed(6))
}

/** « 7 % », « 6,5 % ». */
export function formatPercent(rate: Decimal | null | undefined): string {
  const p = rateToPercent(rate)
  return p === '' ? '' : `${p.replace('.', ',')}\u00a0%`
}

const formatters = new Map<string, Intl.NumberFormat>()

/**
 * Montant dans sa devise, en unités (pas en centimes : `formatMoney` des paiements prend des
 * centimes). XOF et XAF n'ont pas de décimales.
 */
export function formatAmount(value: Decimal | null | undefined, currency: string): string {
  const n = Number(value)
  if (value === null || value === undefined || Number.isNaN(n)) return ''
  let f = formatters.get(currency)
  if (!f) {
    const digits = currency === 'XOF' || currency === 'XAF' ? 0 : 2
    f = new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
    })
    formatters.set(currency, f)
  }
  return f.format(n)
}

/** Nombre JSON → texte d'un champ, sans notation scientifique ni bruit flottant. */
function decimalToInput(value: Decimal | null | undefined): string {
  if (value === null || value === undefined) return ''
  const n = Number(value)
  return Number.isNaN(n) ? String(value) : String(Math.round(n * 1_000_000) / 1_000_000)
}

/**
 * Brouillon de l'éditeur : pré-rempli avec la grille en vigueur, sinon la grille par défaut. Une
 * devise sans minimum dans la grille reprend le minimum par défaut (le back les exige toutes).
 */
export function draftFromGrid(grid: CommissionGrid | null | undefined): GridDraft {
  const tiers = grid?.tiers?.length
    ? grid.tiers.map(t => ({ fromEur: decimalToInput(t.fromEur), ratePercent: rateToPercent(t.rate) }))
    : DEFAULT_TIERS.map(t => ({ ...t }))
  const minimums = {} as Record<CommissionCurrency, string>
  for (const c of COMMISSION_CURRENCIES) {
    const v = grid?.minimums?.[c]
    minimums[c] = v === null || v === undefined ? DEFAULT_MINIMUMS[c] : decimalToInput(v)
  }
  return { tiers, minimums, effectiveFromParis: '', note: '' }
}

/** Brouillon → corps du `POST` ; une saisie illisible part en `null`, que le back signale par champ. */
export function draftToRequest(draft: GridDraft, acknowledgedWarnings: CommissionGridWarning[] = []): CommissionGridRequest {
  const minimums: Record<string, string | null> = {}
  for (const c of COMMISSION_CURRENCIES) {
    const n = parseDecimalInput(draft.minimums[c])
    minimums[c] = n === null ? null : String(n)
  }
  const note = draft.note.trim()
  return {
    tiers: draft.tiers.map(t => ({ fromEur: parseDecimalInput(t.fromEur), rate: percentToRate(t.ratePercent) })),
    minimums,
    effectiveFrom: parisInputToUtc(draft.effectiveFromParis),
    note: note === '' ? null : note,
    acknowledgedWarnings: [...acknowledgedWarnings],
  }
}

/** État d'une grille de l'historique, relu sur l'horloge : une programmée finit par entrer en vigueur. */
export function gridState(grid: CommissionGrid, currentId: string | null | undefined, now = Date.now()): GridState {
  if (grid.cancelledAt) return 'cancelled'
  if (currentId && grid.id === currentId) return 'current'
  return parseServerDate(grid.effectiveFrom) > now ? 'scheduled' : 'past'
}

/** Bornes lisibles d'une tranche : « De 0 € à 100 € », « À partir de 300 € ». */
export function tierRangeLabel(grid: Pick<CommissionGrid, 'tiers'>, index: number): string {
  const from = formatAmount(grid.tiers[index]?.fromEur, 'EUR')
  const next = grid.tiers[index + 1]
  return next ? `De ${from} à ${formatAmount(next.fromEur, 'EUR')}` : `À partir de ${from}`
}

const deltaFormatters = new Map<string, Intl.NumberFormat>()

/** Écart signé entre deux montants servis par le back (« +0,20 € »), arrondi à l'unité mineure. */
export function formatAmountDelta(next: Decimal | null | undefined, previous: Decimal | null | undefined, currency: string): string {
  const a = Number(next)
  const b = Number(previous)
  if (next === null || next === undefined || previous === null || previous === undefined || Number.isNaN(a) || Number.isNaN(b)) return ''
  const digits = currency === 'XOF' || currency === 'XAF' ? 0 : 2
  const factor = 10 ** digits
  let f = deltaFormatters.get(currency)
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency, signDisplay: 'exceptZero', minimumFractionDigits: digits, maximumFractionDigits: digits,
    })
    deltaFormatters.set(currency, f)
  }
  return f.format(Math.round((a - b) * factor) / factor)
}

/** Signe de l'écart, pour sa couleur : hausse, baisse ou identique. */
export function deltaSign(next: Decimal, previous: Decimal): 1 | -1 | 0 {
  const d = Math.round((Number(next) - Number(previous)) * 100)
  return d > 0 ? 1 : d < 0 ? -1 : 0
}
