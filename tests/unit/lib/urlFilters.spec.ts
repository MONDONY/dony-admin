import { describe, it, expect } from 'vitest'
import { readFilters, sameQuery, writeFilters, type FilterSpecs } from '@/lib/urlFilters'

const specs: FilterSpecs<'status' | 'query' | 'dateFrom' | 'dateTo' | 'hideAbandoned'> = {
  status: { default: 'TOUS', allowed: ['TOUS', 'ESCROW', 'FAILED'] },
  query: { default: '' },
  dateFrom: { default: null },
  dateTo: { default: null },
  hideAbandoned: { default: true },
}

describe('readFilters', () => {
  it('lit les paramètres présents et valides', () => {
    expect(readFilters({ status: 'ESCROW', query: 'YD-1', dateFrom: '2026-07-01' }, specs))
      .toEqual({ status: 'ESCROW', query: 'YD-1', dateFrom: '2026-07-01' })
  })

  it('ignore une valeur hors liste, une date mal formée et une chaîne trop longue', () => {
    expect(readFilters({ status: 'PIRATE', dateFrom: 'hier', dateTo: '2026-07-01', query: 'x'.repeat(500) }, specs))
      .toEqual({ dateTo: '2026-07-01' })
  })

  it('lit un booléen true/false et rejette le reste', () => {
    expect(readFilters({ hideAbandoned: 'false' }, specs)).toEqual({ hideAbandoned: false })
    expect(readFilters({ hideAbandoned: 'true' }, specs)).toEqual({ hideAbandoned: true })
    expect(readFilters({ hideAbandoned: 'oui' }, specs)).toEqual({})
  })

  it('prend la première valeur d’un paramètre répété et tolère une query absente', () => {
    expect(readFilters({ status: ['FAILED', 'ESCROW'] }, specs)).toEqual({ status: 'FAILED' })
    expect(readFilters(undefined, specs)).toEqual({})
    expect(readFilters({ status: 42 }, specs)).toEqual({})
  })

  it('respecte un nom de paramètre différent de la clé', () => {
    const renamed: FilterSpecs<'q'> = { q: { default: '', param: 'query' } }
    expect(readFilters({ query: 'abc' }, renamed)).toEqual({ q: 'abc' })
  })
})

describe('writeFilters', () => {
  const defaults = { status: 'TOUS', query: '', dateFrom: null, dateTo: null, hideAbandoned: true } as const

  it('retire les filtres à leur valeur par défaut et garde les autres paramètres', () => {
    expect(writeFilters({ tab: 'wallets', status: 'ESCROW' }, { ...defaults }, specs)).toEqual({ tab: 'wallets' })
  })

  it('écrit les filtres actifs en chaîne', () => {
    expect(writeFilters({}, { ...defaults, status: 'FAILED', query: 'YD', dateFrom: '2026-07-01', hideAbandoned: false }, specs))
      .toEqual({ status: 'FAILED', query: 'YD', dateFrom: '2026-07-01', hideAbandoned: 'false' })
  })

  it('part d’une query vide quand il n’y en a pas', () => {
    expect(writeFilters(undefined, { ...defaults }, specs)).toEqual({})
  })
})

describe('sameQuery', () => {
  it('compare les paramètres sans tenir compte de l’ordre ni du type tableau', () => {
    expect(sameQuery({ a: '1', b: ['2'] }, { b: '2', a: '1' })).toBe(true)
  })
  it('détecte une différence de valeur ou de nombre de paramètres', () => {
    expect(sameQuery({ a: '1' }, { a: '2' })).toBe(false)
    expect(sameQuery({ a: '1' }, { a: '1', b: '2' })).toBe(false)
    expect(sameQuery(undefined, {})).toBe(true)
  })
})
