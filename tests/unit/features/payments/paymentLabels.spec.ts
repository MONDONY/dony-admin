import { describe, it, expect } from 'vitest'
import { paymentAge, tripSearchText } from '@/features/payments/lib/paymentLabels'

const NOW = Date.parse('2026-10-23T10:00:00Z')

describe('paymentAge', () => {
  it('ancienneté relative : minutes, heures, jours', () => {
    expect(paymentAge('2026-10-23T09:59:40', NOW)?.relative).toBe('à l’instant')
    expect(paymentAge('2026-10-23T09:35:00', NOW)?.relative).toBe('il y a 25 min')
    expect(paymentAge('2026-10-23T05:00:00Z', NOW)?.relative).toBe('il y a 5 h')
    expect(paymentAge('2026-10-19T10:00:00', NOW)?.relative).toBe('il y a 4 j')
  })
  it('date courte, année seulement si elle diffère', () => {
    expect(paymentAge('2026-10-19T10:00:00', NOW)?.day).toBe('19 oct.')
    expect(paymentAge('2025-12-31T10:00:00', NOW)?.day).toBe('31 déc. 2025')
  })
  it('date du serveur sans fuseau lue en UTC', () => {
    // 2026-10-23T08:00 UTC, deux heures avant NOW, quel que soit le fuseau du navigateur.
    expect(paymentAge('2026-10-23T08:00:00', NOW)?.relative).toBe('il y a 2 h')
  })
  it('date future (horloge décalée) : à l’instant ; illisible : null', () => {
    expect(paymentAge('2026-10-23T10:05:00Z', NOW)?.relative).toBe('à l’instant')
    expect(paymentAge('pas une date', NOW)).toBeNull()
    expect(paymentAge(null, NOW)).toBeNull()
  })
})

describe('tripSearchText', () => {
  it('« Paris Dakar » : les deux villes, sans flèche', () => {
    expect(tripSearchText({ departureCity: 'Paris', arrivalCity: 'Dakar' })).toBe('Paris Dakar')
    expect(tripSearchText({ departureCity: ' Lyon ', arrivalCity: '' })).toBe('Lyon')
  })
})
