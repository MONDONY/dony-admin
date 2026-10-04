import { describe, expect, it } from 'vitest'
import {
  reportDescriptionText, reportKind, reportKindLabel, reportKindQuery,
} from '@/features/signalements/reportKind'

const screen = (description: string | null) => ({ reason: 'SCREEN_BUG', description })

describe('reportKind', () => {
  it.each([
    ['[BUG] Écran figé', 'BUG'],
    ['[AVIS] Parcours clair', 'AVIS'],
    ['[SUGGESTION] Ajouter un filtre', 'SUGGESTION'],
    ['[avis] casse ignorée', 'AVIS'],
  ])('lit le préfixe de « %s »', (description, kind) => {
    expect(reportKind(screen(description))).toBe(kind)
  })

  it('rend null sans préfixe, sans description ou pour un autre motif', () => {
    expect(reportKind(screen('Écran figé'))).toBeNull()
    expect(reportKind(screen(null))).toBeNull()
    expect(reportKind({ reason: 'SPAM', description: '[AVIS] texte' })).toBeNull()
  })

  it('retire le préfixe de la description affichée', () => {
    expect(reportDescriptionText(screen('[SUGGESTION] Ajouter un filtre'))).toBe('Ajouter un filtre')
    expect(reportDescriptionText({ reason: 'SPAM', description: '[AVIS] texte' })).toBe('[AVIS] texte')
    expect(reportDescriptionText(screen(null))).toBeNull()
  })

  it('libelle le type et construit la recherche back', () => {
    expect(reportKindLabel('AVIS')).toBe('Avis')
    expect(reportKindQuery('SUGGESTION')).toBe('[SUGGESTION]')
  })
})
