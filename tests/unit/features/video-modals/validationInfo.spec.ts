import { describe, it, expect } from 'vitest'
import { hasErrors, validateVideoModal } from '@/features/video-modals/lib/validation'
import { infoInput, validInput } from './fixtures'

describe('validateVideoModal : type INFO', () => {
  it('une campagne complète passe, sans lien ni durée', () => {
    expect(validateVideoModal(infoInput())).toEqual({})
  })

  it('texte FR obligatoire, 500 caractères au plus (FR et EN)', () => {
    expect(validateVideoModal(infoInput({ bodyFr: '  ' })).bodyFr).toContain('obligatoire')
    expect(validateVideoModal(infoInput({ bodyFr: 'a'.repeat(500) })).bodyFr).toBeUndefined()
    expect(validateVideoModal(infoInput({ bodyFr: 'a'.repeat(501) })).bodyFr).toContain('trop long')
    expect(validateVideoModal(infoInput({ bodyEn: 'a'.repeat(501) })).bodyEn).toContain('trop long')
    expect(validateVideoModal(infoInput({ bodyEn: '' })).bodyEn).toBeUndefined()
  })

  it('nom et titre FR obligatoires', () => {
    const e = validateVideoModal(infoInput({ name: '', titleFr: '' }))
    expect(e.name).toBeTruthy()
    expect(e.titleFr).toBeTruthy()
  })

  it('icône hors liste refusée, BELL et INFO acceptées', () => {
    expect(validateVideoModal(infoInput({ icon: 'ROCKET' as never })).icon).toBeTruthy()
    expect(validateVideoModal(infoInput({ icon: 'INFO' })).icon).toBeUndefined()
    expect(validateVideoModal(infoInput({ icon: undefined }))).toEqual({})
  })

  it('action principale absente ou inconnue', () => {
    expect(validateVideoModal(infoInput({ primaryAction: null })).primaryAction).toBeTruthy()
    expect(validateVideoModal(infoInput({ primaryAction: { kind: 'AUTRE' as never, screen: null, url: null } })).primaryAction).toBeTruthy()
  })

  it('SCREEN : écran de la liste et libellé FR obligatoires', () => {
    expect(validateVideoModal(infoInput({ primaryAction: { kind: 'SCREEN', screen: null, url: null } })).primaryAction).toContain('écran')
    expect(validateVideoModal(infoInput({ primaryAction: { kind: 'SCREEN', screen: 'NOPE' as never, url: null } })).primaryAction).toBeTruthy()
    expect(validateVideoModal(infoInput({ primaryLabelFr: ' ' })).primaryLabelFr).toContain('Libellé obligatoire')
  })

  it('URL : https uniquement, libellé obligatoire', () => {
    const url = (u: string | null) => infoInput({ primaryAction: { kind: 'URL', screen: null, url: u } })
    expect(validateVideoModal(url('https://yadony.com')).primaryUrl).toBeUndefined()
    expect(validateVideoModal(url('http://yadony.com')).primaryUrl).toContain('https://')
    expect(validateVideoModal(url('javascript:alert(1)')).primaryUrl).toBeTruthy()
    expect(validateVideoModal(url(null)).primaryUrl).toBeTruthy()
    expect(validateVideoModal({ ...url('https://yadony.com'), primaryLabelFr: '' }).primaryLabelFr).toContain('ouvrir un lien')
  })

  it('CLOSE : libellé vide accepté (OK par défaut)', () => {
    const e = validateVideoModal(infoInput({
      primaryAction: { kind: 'CLOSE', screen: null, url: null }, primaryLabelFr: '', primaryLabelEn: '',
    }))
    expect(e).toEqual({})
  })

  it('libellés limités à 26 caractères', () => {
    const long = 'x'.repeat(27)
    const e = validateVideoModal(infoInput({ primaryLabelFr: long, primaryLabelEn: long }))
    expect(e.primaryLabelFr).toContain('26')
    expect(e.primaryLabelEn).toContain('26')
  })

  it('bouton secondaire facultatif, mêmes règles quand il existe', () => {
    expect(validateVideoModal(infoInput({ secondaryAction: null }))).toEqual({})
    const long = 'x'.repeat(27)
    const bad = validateVideoModal(infoInput({
      secondaryAction: { kind: 'URL', screen: null, url: 'http://x.fr' }, secondaryLabelFr: '', secondaryLabelEn: long,
    }))
    expect(bad.secondaryUrl).toBeTruthy()
    expect(bad.secondaryLabelEn).toContain('26')
    expect(validateVideoModal(infoInput({ secondaryAction: { kind: 'SCREEN', screen: null, url: null } })).secondaryAction).toBeTruthy()
    expect(validateVideoModal(infoInput({ secondaryAction: { kind: 'SCREEN', screen: 'HELP', url: null }, secondaryLabelFr: '' })).secondaryLabelFr).toBeTruthy()
    expect(validateVideoModal(infoInput({ secondaryAction: { kind: 'CLOSE', screen: null, url: null }, secondaryLabelFr: 'Plus tard' }))).toEqual({})
    expect(validateVideoModal(infoInput({ secondaryAction: { kind: 'SCREEN', screen: 'HELP', url: null }, secondaryLabelFr: 'Aide', secondaryLabelEn: long })).secondaryLabelEn).toContain('26')
    expect(validateVideoModal(infoInput({ secondaryAction: { kind: 'URL', screen: null, url: 'https://x.fr' }, secondaryLabelFr: long })).secondaryLabelFr).toContain('26')
  })

  it('déclencheurs, affichages et période comme pour la vidéo', () => {
    const e = validateVideoModal(infoInput({
      triggers: [], maxDisplays: 11, startsAt: '2026-11-10T10:00:00Z', endsAt: '2026-11-09T10:00:00Z',
    }))
    expect(e.triggers).toBeTruthy()
    expect(e.maxDisplays).toBeTruthy()
    expect(e.period).toBeTruthy()
    expect(hasErrors(e)).toBe(true)
  })
})

describe('validateVideoModal : type VIDEO inchangé', () => {
  it('lien YouTube toujours obligatoire, aucune règle Information appliquée', () => {
    expect(validateVideoModal(validInput())).toEqual({})
    expect(validateVideoModal(validInput({ youtubeUrl: '' })).youtubeUrl).toBeTruthy()
    expect(validateVideoModal(validInput({ bodyFr: '' }))).toEqual({})
  })
})
