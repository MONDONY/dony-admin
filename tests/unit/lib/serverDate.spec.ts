import { describe, it, expect } from 'vitest'
import { parseServerDate, serverDateIso } from '@/lib/serverDate'

describe('parseServerDate', () => {
  it('date-heure sans fuseau : lue en UTC (convention du back)', () => {
    expect(parseServerDate('2026-09-28T10:00:00')).toBe(Date.UTC(2026, 8, 28, 10, 0, 0))
    expect(parseServerDate('2026-09-28T10:00')).toBe(Date.UTC(2026, 8, 28, 10, 0, 0))
  })
  it('microsecondes Java tronquées à la milliseconde', () => {
    expect(parseServerDate('2026-09-28T10:00:00.123456')).toBe(Date.UTC(2026, 8, 28, 10, 0, 0, 123))
    expect(parseServerDate('2026-09-28T10:00:00.5')).toBe(Date.UTC(2026, 8, 28, 10, 0, 0, 500))
  })
  it('fuseau explicite respecté', () => {
    expect(parseServerDate('2026-09-28T10:00:00Z')).toBe(Date.UTC(2026, 8, 28, 10, 0, 0))
    expect(parseServerDate('2026-09-28T12:00:00+02:00')).toBe(Date.UTC(2026, 8, 28, 10, 0, 0))
    expect(parseServerDate('2026-09-28T12:00:00.123456+0200')).toBe(Date.UTC(2026, 8, 28, 10, 0, 0, 123))
    expect(parseServerDate('2026-09-28T05:00:00-05:00')).toBe(Date.UTC(2026, 8, 28, 10, 0, 0))
  })
  it('date seule laissée telle quelle', () => {
    expect(serverDateIso('2026-09-15')).toBe('2026-09-15')
    expect(parseServerDate('2026-09-15')).toBe(Date.parse('2026-09-15'))
  })
  it('vide ou illisible : NaN', () => {
    expect(parseServerDate(null)).toBeNaN()
    expect(parseServerDate(undefined)).toBeNaN()
    expect(parseServerDate('')).toBeNaN()
    expect(parseServerDate('pas une date')).toBeNaN()
  })
  it('serverDateIso ajoute Z seulement sans fuseau', () => {
    expect(serverDateIso('2026-09-28T10:00:00')).toBe('2026-09-28T10:00:00Z')
    expect(serverDateIso('2026-09-28T10:00:00Z')).toBe('2026-09-28T10:00:00Z')
    expect(serverDateIso('2026-09-28T10:00:00+02:00')).toBe('2026-09-28T10:00:00+02:00')
  })
})
