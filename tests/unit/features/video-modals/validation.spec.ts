import { describe, it, expect } from 'vitest'
import { hasErrors, validateVideoModal } from '@/features/video-modals/lib/validation'
import type { VideoModalHighlight, VideoModalTrigger } from '@/features/video-modals/types/index'
import { validInput } from './fixtures'

describe('validateVideoModal', () => {
  it('une campagne complète passe', () => {
    const e = validateVideoModal(validInput())
    expect(e).toEqual({})
    expect(hasErrors(e)).toBe(false)
  })

  it('accepte 0 point fort, la durée absente et une période ouverte', () => {
    expect(validateVideoModal(validInput({ highlights: [], durationSeconds: null, startsAt: '2026-11-10T10:00:00Z' }))).toEqual({})
  })

  it('nom obligatoire', () => {
    expect(validateVideoModal(validInput({ name: '  ' })).name).toBeTruthy()
  })

  it('lien YouTube vide ou non reconnu : deux messages distincts', () => {
    const empty = validateVideoModal(validInput({ youtubeUrl: '' })).youtubeUrl
    const wrong = validateVideoModal(validInput({ youtubeUrl: 'https://vimeo.com/123' })).youtubeUrl
    expect(empty).toContain('Collez')
    expect(wrong).toContain('Lien non reconnu')
  })

  it('durée : entier positif', () => {
    expect(validateVideoModal(validInput({ durationSeconds: -1 })).durationSeconds).toBeTruthy()
    expect(validateVideoModal(validInput({ durationSeconds: 1.5 })).durationSeconds).toBeTruthy()
    expect(validateVideoModal(validInput({ durationSeconds: Number.NaN })).durationSeconds).toBeTruthy()
    expect(validateVideoModal(validInput({ durationSeconds: 0 })).durationSeconds).toBeUndefined()
  })

  it('titre FR obligatoire, titre EN facultatif', () => {
    expect(validateVideoModal(validInput({ titleFr: '' })).titleFr).toBeTruthy()
    expect(validateVideoModal(validInput({ titleEn: '' }))).toEqual({})
  })

  it('libellés FR des deux boutons obligatoires', () => {
    const e = validateVideoModal(validInput({ primaryLabelFr: '', secondaryLabelFr: ' ' }))
    expect(e.primaryLabelFr).toBeTruthy()
    expect(e.secondaryLabelFr).toBeTruthy()
  })

  it('trois points forts au plus', () => {
    const h: VideoModalHighlight = { icon: 'STAR', textFr: 'x', textEn: '' }
    expect(validateVideoModal(validInput({ highlights: [h, h, h] }))).toEqual({})
    expect(validateVideoModal(validInput({ highlights: [h, h, h, h] })).highlights).toContain('Trois')
  })

  it('point fort : icône connue et texte FR', () => {
    const badIcon = { icon: 'ROCKET', textFr: 'x', textEn: '' } as unknown as VideoModalHighlight
    expect(validateVideoModal(validInput({ highlights: [badIcon] })).highlights).toContain('icône')
    expect(validateVideoModal(validInput({ highlights: [{ icon: 'QR', textFr: ' ', textEn: 'x' }] })).highlights).toContain('texte')
  })

  it('au moins un déclencheur connu', () => {
    expect(validateVideoModal(validInput({ triggers: [] })).triggers).toBeTruthy()
    expect(validateVideoModal(validInput({ triggers: ['HOME' as VideoModalTrigger] })).triggers).toBeTruthy()
    expect(validateVideoModal(validInput({ triggers: ['PUBLISH_TRIP', 'SEND_PARCEL'] }))).toEqual({})
  })

  it.each([0, 11, 2.5, Number.NaN])('maxDisplays %s refusé', (n) => {
    expect(validateVideoModal(validInput({ maxDisplays: n })).maxDisplays).toBeTruthy()
  })
  it.each([1, 10])('maxDisplays %s accepté', (n) => {
    expect(validateVideoModal(validInput({ maxDisplays: n })).maxDisplays).toBeUndefined()
  })

  it('la fin doit être après le début', () => {
    const at = '2026-11-10T10:00:00Z'
    expect(validateVideoModal(validInput({ startsAt: at, endsAt: at })).period).toBeTruthy()
    expect(validateVideoModal(validInput({ startsAt: at, endsAt: '2026-11-09T10:00:00Z' })).period).toBeTruthy()
    expect(validateVideoModal(validInput({ startsAt: at, endsAt: '2026-11-11T10:00:00Z' })).period).toBeUndefined()
    expect(validateVideoModal(validInput({ startsAt: 'illisible', endsAt: at })).period).toBeUndefined()
  })
})
