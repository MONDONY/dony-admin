import { describe, it, expect } from 'vitest'
import { defaultFormState, formStateFromModal, inputFromFormState } from '@/features/video-modals/lib/form'
import { validateVideoModal } from '@/features/video-modals/lib/validation'
import { infoInput, infoModal, modal, validInput } from './fixtures'

describe('format et taille : formulaire', () => {
  it('défauts : feuille du bas, taille automatique, sans image', () => {
    const s = defaultFormState(['SEARCH_TAB'], 'INFO')
    expect(s).toMatchObject({ layout: 'BOTTOM_SHEET', sizePercent: null, imageMode: 'NONE', imageFit: 'COVER', imageAltFr: '', imageAltEn: '' })
  })

  it('campagne ancienne (sans les champs) : valeurs par défaut', () => {
    expect(formStateFromModal(modal())).toMatchObject({ layout: 'BOTTOM_SHEET', sizePercent: null, imageMode: 'NONE' })
    expect(formStateFromModal(infoModal())).toMatchObject({ layout: 'BOTTOM_SHEET', sizePercent: null, imageMode: 'NONE', imageFit: 'COVER' })
  })

  it('relit le format, la taille et l’image d’une campagne', () => {
    const s = formStateFromModal(infoModal({ layout: 'CENTERED', sizePercent: 60, imageMode: 'POSTER', imageFit: 'CONTAIN', imageAltFr: 'Affiche', imageAltEn: 'Poster', imageUrl: 'https://cdn/x.jpg' }))
    expect(s).toMatchObject({ layout: 'CENTERED', sizePercent: 60, imageMode: 'POSTER', imageFit: 'CONTAIN', imageAltFr: 'Affiche', imageAltEn: 'Poster' })
  })

  it('une vidéo envoie format et taille, jamais d’image', () => {
    const s = { ...defaultFormState(), name: 'V', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', layout: 'CENTERED' as const, sizePercent: 70 }
    const body = inputFromFormState(s)
    expect(body).toMatchObject({ type: 'VIDEO', layout: 'CENTERED', sizePercent: 70 })
    expect(body).not.toHaveProperty('imageMode')
    expect(body).not.toHaveProperty('imageUrl')
  })

  it('une information envoie le mode, le cadrage et les textes alternatifs rognés', () => {
    const s = { ...formStateFromModal(infoModal()), layout: 'BOTTOM_SHEET' as const, sizePercent: 45, imageMode: 'TOP' as const, imageFit: 'CONTAIN' as const, imageAltFr: ' Affiche ', imageAltEn: '' }
    const body = inputFromFormState(s)
    expect(body).toMatchObject({ layout: 'BOTTOM_SHEET', sizePercent: 45, imageMode: 'TOP', imageFit: 'CONTAIN', imageAltFr: 'Affiche', imageAltEn: '' })
    expect(body).not.toHaveProperty('imageUrl')
  })

  it('plein écran : la taille n’est pas envoyée', () => {
    const s = { ...formStateFromModal(infoModal()), layout: 'FULLSCREEN' as const, sizePercent: 50 }
    expect(inputFromFormState(s).sizePercent).toBeNull()
  })

  it('taille vide ou automatique : null', () => {
    const s = { ...formStateFromModal(infoModal()), sizePercent: '' as unknown as number }
    expect(inputFromFormState(s).sizePercent).toBeNull()
  })
})

describe('format et taille : validation', () => {
  it('campagnes sans les nouveaux champs : valides comme avant', () => {
    expect(validateVideoModal(validInput())).toEqual({})
    expect(validateVideoModal(infoInput())).toEqual({})
  })

  it.each([29, 101, 0, -5, 45.5])('taille %s refusée', (n) => {
    expect(validateVideoModal(validInput({ sizePercent: n })).sizePercent).toContain('30')
    expect(validateVideoModal(infoInput({ sizePercent: n })).sizePercent).toContain('100')
  })

  it.each([30, 65, 100, null])('taille %s acceptée', (n) => {
    expect(validateVideoModal(validInput({ sizePercent: n })).sizePercent).toBeUndefined()
  })

  it('format inconnu refusé', () => {
    expect(validateVideoModal(validInput({ layout: 'POPUP' as never })).layout).toBeDefined()
    expect(validateVideoModal(infoInput({ layout: 'CENTERED' })).layout).toBeUndefined()
  })

  it('mode d’image sans image : refusé ; avec image : accepté ; Aucune : toujours accepté', () => {
    expect(validateVideoModal(infoInput({ imageMode: 'TOP' })).imageMode).toContain('image')
    expect(validateVideoModal(infoInput({ imageMode: 'POSTER' }), { hasImage: false }).imageMode).toBeDefined()
    expect(validateVideoModal(infoInput({ imageMode: 'POSTER' }), { hasImage: true }).imageMode).toBeUndefined()
    expect(validateVideoModal(infoInput({ imageMode: 'NONE' })).imageMode).toBeUndefined()
  })

  it('mode et cadrage inconnus refusés', () => {
    const e = validateVideoModal(infoInput({ imageMode: 'FULL' as never, imageFit: 'STRETCH' as never }))
    expect(e.imageMode).toBeDefined()
    expect(e.imageFit).toBeDefined()
  })

  it('texte alternatif : 200 caractères au plus', () => {
    expect(validateVideoModal(infoInput({ imageAltFr: 'a'.repeat(200), imageAltEn: 'b'.repeat(200) }))).toEqual({})
    const e = validateVideoModal(infoInput({ imageAltFr: 'a'.repeat(201), imageAltEn: 'b'.repeat(201) }))
    expect(e.imageAltFr).toContain('200')
    expect(e.imageAltEn).toContain('200')
  })

  it('l’image ne concerne pas la vidéo : mode ignoré', () => {
    expect(validateVideoModal(validInput({ imageMode: 'POSTER' })).imageMode).toBeUndefined()
  })
})
