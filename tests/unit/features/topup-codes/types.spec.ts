import { describe, it, expect } from 'vitest'
import { formatTopupAmount, parseUtc } from '@/features/topup-codes/types/index'

describe('formatTopupAmount', () => {
  it('franc CFA sans décimales', () => {
    expect(formatTopupAmount(2000, 'XOF').replace(/\s/g, ' ')).toBe('2 000 XOF')
  })
  it('euro avec deux décimales', () => {
    expect(formatTopupAmount(10, 'EUR').replace(/\s/g, ' ')).toBe('10,00 EUR')
  })
})

describe('parseUtc', () => {
  it('lit une date sans fuseau comme UTC', () => {
    expect(parseUtc('2027-01-01T00:00:00').toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
  it('respecte un Z existant', () => {
    expect(parseUtc('2027-01-01T00:00:00Z').toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
  it('respecte un décalage explicite', () => {
    expect(parseUtc('2027-01-01T01:00:00+01:00').toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(parseUtc('2027-01-01T01:00:00-0100').toISOString()).toBe('2027-01-01T02:00:00.000Z')
  })
  it('gère les fractions de seconde sans fuseau', () => {
    expect(parseUtc('2027-01-01T00:00:00.123456').getUTCMilliseconds()).toBe(123)
  })
})
