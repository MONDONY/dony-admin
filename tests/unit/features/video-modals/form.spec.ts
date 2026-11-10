import { describe, it, expect } from 'vitest'
import {
  defaultFormState, formStateFromModal, inputFromFormState, isoToLocalInput, localInputToIso, localized,
} from '@/features/video-modals/lib/form'
import type { AdminVideoModal } from '@/features/video-modals/types/index'
import { infoModal, modal } from './fixtures'

describe('dates', () => {
  it('aller-retour ISO / champ local', () => {
    const local = isoToLocalInput('2026-11-10T10:30:00Z')
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(localInputToIso(local)).toBe('2026-11-10T10:30:00.000Z')
  })
  it('vide ou illisible', () => {
    expect(isoToLocalInput(null)).toBe('')
    expect(isoToLocalInput('n’importe quoi')).toBe('')
    expect(localInputToIso('')).toBeNull()
    expect(localInputToIso('n’importe quoi')).toBeNull()
  })
})

describe('état du formulaire', () => {
  it('défauts : Rechercher, 3 affichages, libellés des boutons préremplis', () => {
    const s = defaultFormState()
    expect(s.triggers).toEqual(['SEARCH_TAB'])
    expect(s.maxDisplays).toBe(3)
    expect(s.primaryLabelFr).toBe('Voir la vidéo')
    expect(s.secondaryLabelEn).toBe('Get started')
    expect(defaultFormState(['APP_OPEN']).triggers).toEqual(['APP_OPEN'])
  })

  it('depuis une campagne puis vers le corps d’API, sans perte', () => {
    const m = modal({ startsAt: '2026-11-10T10:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z' })
    const body = inputFromFormState(formStateFromModal(m))
    expect(body).toEqual({
      type: 'VIDEO', name: m.name, youtubeUrl: m.youtubeUrl, durationSeconds: 204,
      titleFr: m.titleFr, titleEn: m.titleEn, subtitleFr: m.subtitleFr, subtitleEn: m.subtitleEn,
      primaryLabelFr: m.primaryLabelFr, primaryLabelEn: m.primaryLabelEn,
      secondaryLabelFr: m.secondaryLabelFr, secondaryLabelEn: m.secondaryLabelEn,
      highlights: m.highlights, triggers: m.triggers, maxDisplays: 3,
      startsAt: '2026-11-10T10:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z',
      // Campagne d'avant le format : feuille du bas, taille automatique, aucun champ d'image pour une vidéo.
      layout: 'BOTTOM_SHEET', sizePercent: null,
      // Campagne d'avant le ciblage : même comportement qu'avant (jusqu'à 3 fois, arrêt après une réponse, tout le monde).
      frequency: 'UP_TO_N', frequencyDays: null, stopAfterAnswer: true, allowDontShowAgain: false, priority: 0,
      connectedOnly: false, conditions: null, minAppVersion: null, maxAppVersion: null, platforms: [], samplePercent: 100, situations: [],
    })
  })

  it('tolère les champs absents d’un back plus ancien', () => {
    const partial = { id: 'x', version: 1 } as unknown as AdminVideoModal
    const s = formStateFromModal(partial)
    expect(s.name).toBe('')
    expect(s.highlights).toEqual([])
    expect(s.triggers).toEqual([])
    expect(s.maxDisplays).toBe(3)
    expect(s.durationSeconds).toBeNull()
    const h = formStateFromModal({ ...modal(), highlights: [{ icon: 'STAR' }] } as unknown as AdminVideoModal).highlights
    expect(h).toEqual([{ icon: 'STAR', textFr: '', textEn: '' }])
  })

  it('rogne les textes et convertit les nombres', () => {
    const s = { ...defaultFormState(), frequency: 'UP_TO_N' as const, name: '  A  ', durationSeconds: '90', maxDisplays: '4' as unknown as number,
      highlights: [{ icon: 'LOCK' as const, textFr: ' a ', textEn: ' b ' }] }
    const body = inputFromFormState(s)
    expect(body.name).toBe('A')
    expect(body.durationSeconds).toBe(90)
    expect(body.maxDisplays).toBe(4)
    expect(body.highlights).toEqual([{ icon: 'LOCK', textFr: 'a', textEn: 'b' }])
    expect(body.startsAt).toBeNull()
    expect(inputFromFormState({ ...s, durationSeconds: '' }).durationSeconds).toBeNull()
    expect(inputFromFormState({ ...s, durationSeconds: 'abc' }).durationSeconds).toBeNaN()
  })
})

describe('localized', () => {
  it('EN si rempli, sinon repli FR', () => {
    expect(localized('Bonjour', 'Hello', 'en')).toBe('Hello')
    expect(localized('Bonjour', '  ', 'en')).toBe('Bonjour')
    expect(localized('Bonjour', 'Hello', 'fr')).toBe('Bonjour')
  })
})

describe('modal Information : état et corps d’API', () => {
  it('défauts INFO : icône INFO, libellés OK, action Fermer, pas de secondaire', () => {
    const s = defaultFormState(['SEARCH_TAB'], 'INFO')
    expect(s.type).toBe('INFO')
    expect(s.icon).toBe('INFO')
    expect(s.primaryLabelFr).toBe('OK')
    expect(s.primaryAction).toEqual({ kind: 'CLOSE', screen: null, url: null })
    expect(s.secondaryEnabled).toBe(false)
  })

  it('corps INFO : ni lien, ni durée, ni points forts ; secondaire absent = null', () => {
    const body = inputFromFormState(formStateFromModal(infoModal()))
    expect(body).toMatchObject({
      type: 'INFO', youtubeUrl: null, durationSeconds: null, highlights: [], icon: 'BELL',
      bodyFr: 'Découvrez le suivi en direct.', primaryAction: { kind: 'SCREEN', screen: 'TRACKING', url: null },
      secondaryAction: null, secondaryLabelFr: '', secondaryLabelEn: '',
    })
  })

  it('corps INFO avec secondaire URL : lien rogné, écran ignoré', () => {
    const m = infoModal({
      secondaryAction: { kind: 'URL', screen: 'HELP', url: '  https://yadony.com/aide ' },
      secondaryLabelFr: 'En savoir plus', secondaryLabelEn: 'Learn more',
    })
    const state = formStateFromModal(m)
    expect(state.secondaryEnabled).toBe(true)
    const body = inputFromFormState(state)
    expect(body.secondaryAction).toEqual({ kind: 'URL', screen: null, url: 'https://yadony.com/aide' })
    expect(body.secondaryLabelFr).toBe('En savoir plus')
  })

  it('une action SCREEN n’envoie pas de lien', () => {
    const s = formStateFromModal(infoModal())
    s.primaryAction = { kind: 'SCREEN', screen: 'HELP', url: 'https://x.fr' }
    expect(inputFromFormState(s).primaryAction).toEqual({ kind: 'SCREEN', screen: 'HELP', url: null })
  })

  it('campagne sans type (ancien back) = vidéo ; le corps vidéo porte type VIDEO sans champ Information', () => {
    const s = formStateFromModal(modal())
    expect(s.type).toBe('VIDEO')
    const body = inputFromFormState(s)
    expect(body.type).toBe('VIDEO')
    expect(body).not.toHaveProperty('bodyFr')
    expect(body).not.toHaveProperty('primaryAction')
  })
})
