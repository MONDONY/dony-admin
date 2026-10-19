import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  deltaSign, draftFromGrid, draftToRequest, formatAmount, formatAmountDelta, formatPercent, gridState,
  parseDecimalInput, percentToRate, rateToPercent, tierRangeLabel,
} from '@/features/commission-grid/utils/grid'
import { formatParis, parisInputToUtc, utcToParisInput } from '@/features/commission-grid/utils/parisTime'
import { DEFAULT_MINIMUMS } from '@/features/commission-grid/types/index'
import type { CommissionGrid } from '@/features/commission-grid/types/index'

/** Intl sépare par des espaces insécables (fines ou non) : on les ramène à une espace simple. */
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

const GRID: CommissionGrid = {
  id: 'g1', effectiveFrom: '2026-10-31T23:00:00',
  tiers: [{ fromEur: 0, rate: 0.07 }, { fromEur: 100, rate: 0.06 }, { fromEur: 300, rate: 0.05 }],
  minimums: { EUR: 1, XOF: 650, XAF: 650, USD: 1.1, CAD: 1.5, GBP: 0.9, CHF: 0.95 },
}

describe('conversions pourcentage ↔ taux', () => {
  it('rateToPercent absorbe le bruit flottant', () => {
    expect(rateToPercent(0.07)).toBe('7')
    expect(rateToPercent('0.065')).toBe('6.5')
    expect(rateToPercent(0.0575)).toBe('5.75')
    expect(rateToPercent(null)).toBe('')
    expect(rateToPercent('abc')).toBe('')
  })

  it('percentToRate arrondit à 6 décimales et accepte la virgule', () => {
    expect(percentToRate('7')).toBe(0.07)
    expect(percentToRate('6,5')).toBe(0.065)
    expect(percentToRate('0.07')).toBe(0.0007)
    expect(percentToRate('')).toBeNull()
    expect(percentToRate('x')).toBeNull()
  })

  it('parseDecimalInput : vide ou illisible = null', () => {
    expect(parseDecimalInput(' 12,5 ')).toBe(12.5)
    expect(parseDecimalInput(undefined)).toBeNull()
    expect(parseDecimalInput('Infinity')).toBeNull()
  })

  it('formatPercent', () => {
    expect(plain(formatPercent(0.065))).toBe('6,5 %')
    expect(formatPercent(undefined)).toBe('')
  })
})

describe('formatAmount et écarts', () => {
  it('euros à 2 décimales, FCFA sans décimale', () => {
    expect(plain(formatAmount(1.4, 'EUR'))).toBe('1,40 €')
    expect(plain(formatAmount('650', 'XOF'))).toBe('650 F CFA')
    expect(plain(formatAmount(3280, 'XAF'))).toBe('3 280 FCFA')
    expect(formatAmount(null, 'EUR')).toBe('')
    expect(formatAmount('nope', 'EUR')).toBe('')
  })

  it('formatAmountDelta signe l’écart et arrondit', () => {
    expect(plain(formatAmountDelta(1.6, 1.4, 'EUR'))).toBe('+0,20 €')
    expect(plain(formatAmountDelta(1.2, 1.4, 'EUR'))).toMatch(/^[-−]0,20 €$/)
    expect(plain(formatAmountDelta(1.4, 1.4, 'EUR'))).toBe('0,00 €')
    expect(plain(formatAmountDelta(700, 650, 'XOF'))).toBe('+50 F CFA')
    expect(formatAmountDelta(null, 1, 'EUR')).toBe('')
    expect(formatAmountDelta(1, 'x', 'EUR')).toBe('')
  })

  it('deltaSign', () => {
    expect(deltaSign(2, 1)).toBe(1)
    expect(deltaSign(1, 2)).toBe(-1)
    expect(deltaSign('1.001', 1)).toBe(0)
  })
})

describe('brouillon ↔ requête', () => {
  it('draftFromGrid pré-remplit depuis la grille en vigueur (taux en %)', () => {
    const d = draftFromGrid(GRID)
    expect(d.tiers).toEqual([
      { fromEur: '0', ratePercent: '7' }, { fromEur: '100', ratePercent: '6' }, { fromEur: '300', ratePercent: '5' },
    ])
    expect(d.minimums.XOF).toBe('650')
    expect(d.minimums.USD).toBe('1.1')
    expect(d.effectiveFromParis).toBe('')
    expect(d.note).toBe('')
  })

  it('draftFromGrid sans grille : 7/6/5 % aux bornes 0/100/300 et minimums par défaut', () => {
    const d = draftFromGrid(null)
    expect(d.tiers.map(t => [t.fromEur, t.ratePercent])).toEqual([['0', '7'], ['100', '6'], ['300', '5']])
    expect(d.minimums).toEqual(DEFAULT_MINIMUMS)
    // Copie : modifier le brouillon ne touche pas les valeurs par défaut.
    d.tiers[0]!.ratePercent = '9'
    expect(draftFromGrid(null).tiers[0]!.ratePercent).toBe('7')
  })

  it('draftFromGrid : une devise absente reprend le minimum par défaut', () => {
    const d = draftFromGrid({ ...GRID, minimums: { EUR: '2.5' } })
    expect(d.minimums.EUR).toBe('2.5')
    expect(d.minimums.CHF).toBe(DEFAULT_MINIMUMS.CHF)
  })

  it('draftToRequest convertit % → taux, Paris → UTC, et nettoie la note', () => {
    const d = draftFromGrid(GRID)
    d.effectiveFromParis = '2026-11-01T00:00'
    d.note = '  Baisse  '
    d.minimums.EUR = '1,20'
    const req = draftToRequest(d, ['INCREASE_WITHIN_30_DAYS'])
    expect(req.tiers).toEqual([{ fromEur: 0, rate: 0.07 }, { fromEur: 100, rate: 0.06 }, { fromEur: 300, rate: 0.05 }])
    expect(req.minimums.EUR).toBe('1.2')
    expect(req.effectiveFrom).toBe('2026-10-31T23:00:00')
    expect(req.note).toBe('Baisse')
    expect(req.acknowledgedWarnings).toEqual(['INCREASE_WITHIN_30_DAYS'])
  })

  it('draftToRequest : saisies vides = null (le back les signale par champ), date vide = immédiat', () => {
    const d = draftFromGrid(null)
    d.tiers[1]!.ratePercent = ''
    d.minimums.GBP = ' '
    const req = draftToRequest(d)
    expect(req.tiers[1]!.rate).toBeNull()
    expect(req.minimums.GBP).toBeNull()
    expect(req.effectiveFrom).toBeNull()
    expect(req.note).toBeNull()
    expect(req.acknowledgedWarnings).toEqual([])
  })
})

describe('gridState et libellés', () => {
  const now = Date.parse('2026-10-19T10:00:00Z')
  it('annulée, en vigueur, programmée, passée', () => {
    expect(gridState({ ...GRID, cancelledAt: '2026-10-18T10:00:00' }, 'g1', now)).toBe('cancelled')
    expect(gridState(GRID, 'g1', now)).toBe('current')
    expect(gridState(GRID, 'other', now)).toBe('scheduled')
    expect(gridState({ ...GRID, effectiveFrom: '2026-01-01T00:00:00' }, null, now)).toBe('past')
  })

  it('gridState lit l’horloge par défaut', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'))
    expect(gridState(GRID, null)).toBe('past')
    vi.useRealTimers()
  })

  it('tierRangeLabel', () => {
    expect(plain(tierRangeLabel(GRID, 0))).toBe('De 0,00 € à 100,00 €')
    expect(plain(tierRangeLabel(GRID, 2))).toBe('À partir de 300,00 €')
  })
})

describe('heure de Paris ↔ UTC', () => {
  afterEach(() => { vi.useRealTimers() })

  it('hiver (UTC+1) et été (UTC+2)', () => {
    expect(parisInputToUtc('2026-11-01T00:00')).toBe('2026-10-31T23:00:00')
    expect(parisInputToUtc('2026-07-01T12:30')).toBe('2026-07-01T10:30:00')
    expect(parisInputToUtc('2026-07-01T12:30:15')).toBe('2026-07-01T10:30:15')
  })

  it('autour du passage à l’heure d’hiver (25/10/2026 à 3 h)', () => {
    expect(parisInputToUtc('2026-10-25T01:30')).toBe('2026-10-24T23:30:00')
    expect(parisInputToUtc('2026-10-25T04:00')).toBe('2026-10-25T03:00:00')
  })

  it('vide ou illisible = null', () => {
    expect(parisInputToUtc('')).toBeNull()
    expect(parisInputToUtc(null)).toBeNull()
    expect(parisInputToUtc('demain')).toBeNull()
  })

  it('utcToParisInput relit une date du back (UTC sans fuseau) en heure de Paris', () => {
    expect(utcToParisInput('2026-10-31T23:00:00')).toBe('2026-11-01T00:00')
    expect(utcToParisInput('2026-07-01T10:30:00.123456')).toBe('2026-07-01T12:30')
    expect(utcToParisInput(null)).toBe('')
    expect(utcToParisInput('nope')).toBe('')
  })

  it('aller-retour', () => {
    const v = '2026-03-29T03:15'
    expect(utcToParisInput(parisInputToUtc(v))).toBe(v)
  })

  it('formatParis', () => {
    expect(formatParis('2026-10-31T23:00:00')).toBe('1 novembre 2026 à 00:00')
    expect(formatParis('2026-08-15T08:05:00Z')).toBe('15 août 2026 à 10:05')
    expect(formatParis(undefined)).toBe('')
  })
})
