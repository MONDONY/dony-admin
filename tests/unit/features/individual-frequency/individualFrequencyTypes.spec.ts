import { describe, it, expect } from 'vitest'
import { frequencySummary } from '@/features/individual-frequency/types/index'

describe('frequencySummary', () => {
  it('phrase du contrat : trajets avec colis, fenêtre, seuil et statut déclaré', () => {
    expect(frequencySummary({ tripsCount: 5, windowDays: 30, threshold: 4 }))
      .toBe('5 trajets avec colis sur 30 jours (seuil : 4). Statut déclaré : Particulier.')
  })

  it('singulier à 1 trajet', () => {
    expect(frequencySummary({ tripsCount: 1, windowDays: 30, threshold: 0 }))
      .toBe('1 trajet avec colis sur 30 jours (seuil : 0). Statut déclaré : Particulier.')
  })

  it('champs absents : fenêtre de 30 jours par défaut, sans seuil ni nombre inventés', () => {
    expect(frequencySummary({})).toBe('Trajets avec colis sur 30 jours. Statut déclaré : Particulier.')
    expect(frequencySummary({ tripsCount: 6 })).toBe('6 trajets avec colis sur 30 jours. Statut déclaré : Particulier.')
  })
})
