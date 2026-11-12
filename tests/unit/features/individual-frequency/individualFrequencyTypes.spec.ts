import { describe, it, expect } from 'vitest'
import { frequencySummary } from '@/features/individual-frequency/types/index'

describe('frequencySummary', () => {
  it('phrase du contrat : trajets publiés, période, seuil et statut déclaré', () => {
    expect(frequencySummary({ tripsCount: 5, threshold: 4 }))
      .toBe('5 trajets publiés ce mois-ci (seuil : 4). Statut déclaré : Particulier.')
  })

  it('singulier à 1 trajet', () => {
    expect(frequencySummary({ tripsCount: 1, threshold: 0 }))
      .toBe('1 trajet publié ce mois-ci (seuil : 0). Statut déclaré : Particulier.')
  })

  it('libellé de période renvoyé par le back : affiché tel quel', () => {
    expect(frequencySummary({ tripsCount: 5, periodLabel: 'en novembre 2026', threshold: 4 }))
      .toBe('5 trajets publiés en novembre 2026 (seuil : 4). Statut déclaré : Particulier.')
  })

  it('champs absents : période « ce mois-ci » par défaut, sans seuil ni nombre inventés', () => {
    expect(frequencySummary({})).toBe('Trajets publiés ce mois-ci. Statut déclaré : Particulier.')
    expect(frequencySummary({ tripsCount: 6 })).toBe('6 trajets publiés ce mois-ci. Statut déclaré : Particulier.')
  })

  it('weeklyApplication sous le seuil : la phrase GP Pro remplace celle des trajets', () => {
    expect(frequencySummary({ tripsCount: 2, threshold: 4, weeklyApplication: true }))
      .toBe('A demandé GP Pro, fréquence : chaque semaine. Statut déclaré : Particulier.')
  })

  it('weeklyApplication au seuil exact : les trajets ne dépassent pas, phrase GP Pro seule', () => {
    expect(frequencySummary({ tripsCount: 4, threshold: 4, weeklyApplication: true }))
      .toBe('A demandé GP Pro, fréquence : chaque semaine. Statut déclaré : Particulier.')
  })

  it('weeklyApplication au-dessus du seuil : les deux phrases', () => {
    expect(frequencySummary({ tripsCount: 5, threshold: 4, weeklyApplication: true }))
      .toBe('5 trajets publiés ce mois-ci (seuil : 4). A demandé GP Pro, fréquence : chaque semaine. Statut déclaré : Particulier.')
  })

  it('weeklyApplication sans nombre ni seuil : phrase GP Pro seule', () => {
    expect(frequencySummary({ weeklyApplication: true }))
      .toBe('A demandé GP Pro, fréquence : chaque semaine. Statut déclaré : Particulier.')
  })

  it('weeklyApplication faux ou absent : phrase des trajets inchangée', () => {
    const expected = '3 trajets publiés ce mois-ci (seuil : 4). Statut déclaré : Particulier.'
    expect(frequencySummary({ tripsCount: 3, threshold: 4, weeklyApplication: false })).toBe(expected)
    expect(frequencySummary({ tripsCount: 3, threshold: 4 })).toBe(expected)
  })
})
