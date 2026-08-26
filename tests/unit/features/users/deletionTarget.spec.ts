import { describe, it, expect } from 'vitest'
import { deletionConfirmationPhrase } from '@/features/users/deletionTarget'

const base = { id: 'u-42', firstName: 'Jean', lastName: 'Dupont', email: 'jean@x.fr' }

describe('deletionConfirmationPhrase', () => {
  it('utilise le nom complet quand il existe', () => {
    expect(deletionConfirmationPhrase(base)).toBe('Jean Dupont')
  })

  it("tolère un prénom seul", () => {
    expect(deletionConfirmationPhrase({ ...base, lastName: null })).toBe('Jean')
  })

  // Le cœur du test : un compte créé par téléphone et jamais passé par le KYC n'a ni
  // prénom ni nom. Une phrase vide désactiverait la double confirmation sans le dire.
  it("retombe sur l'email quand prénom et nom sont absents", () => {
    expect(deletionConfirmationPhrase({ ...base, firstName: null, lastName: null }))
      .toBe('jean@x.fr')
  })

  it("retombe sur l'identifiant quand il n'y a ni nom ni email", () => {
    expect(deletionConfirmationPhrase({ ...base, firstName: null, lastName: null, email: null }))
      .toBe('u-42')
  })

  it("n'est jamais vide, quelle que soit la combinaison de champs manquants", () => {
    const combinations = [
      { firstName: null, lastName: null, email: null },
      { firstName: '', lastName: '', email: '' },
      { firstName: '   ', lastName: '   ', email: null },
    ]
    for (const c of combinations) {
      expect(deletionConfirmationPhrase({ ...base, ...c }).trim()).not.toBe('')
    }
  })
})
