import { describe, it, expect } from 'vitest'
import { defaultFormState, formStateFromModal, inputFromFormState, normalizeConditions } from '@/features/video-modals/lib/form'
import { frequencyLabel } from '@/features/video-modals/lib/labels'
import { ciRule, infoModal, modal } from './fixtures'

describe('défauts selon le type', () => {
  it.each(['VIDEO', 'INFO'] as const)('%s : une fois, arrêt après une réponse, tout le monde, sans condition', (type) => {
    const s = defaultFormState(['SEARCH_TAB'], type)
    expect(s).toMatchObject({
      frequency: 'ONCE', stopAfterAnswer: true, allowDontShowAgain: false, priority: 0, connectedOnly: false,
      conditions: null, minAppVersion: '', maxAppVersion: '', platforms: [], samplePercent: 100, situations: [],
    })
  })

  it('le corps par défaut reste valide pour le back : une fois = plafond 1', () => {
    const body = inputFromFormState(defaultFormState(['APP_OPEN'], 'VIDEO'))
    expect(body).toMatchObject({
      frequency: 'ONCE', maxDisplays: 1, frequencyDays: null, stopAfterAnswer: true, allowDontShowAgain: false, priority: 0,
      connectedOnly: false, conditions: null, minAppVersion: null, maxAppVersion: null, platforms: [], samplePercent: 100, situations: [],
    })
  })
})

describe('campagne d’avant le ciblage (non-régression)', () => {
  it('vidéo : jusqu’à N fois, arrêt après une réponse, aucun ciblage', () => {
    const s = formStateFromModal(modal({ maxDisplays: 4 }))
    expect(s).toMatchObject({
      frequency: 'UP_TO_N', stopAfterAnswer: true, allowDontShowAgain: false, priority: 0, connectedOnly: false,
      conditions: null, platforms: [], samplePercent: 100, situations: [], minAppVersion: '', maxAppVersion: '',
    })
    const body = inputFromFormState(s)
    expect(body.maxDisplays).toBe(4)
    expect(body.frequency).toBe('UP_TO_N')
  })

  it('information : même chose', () => {
    const s = formStateFromModal(infoModal())
    expect(s.frequency).toBe('UP_TO_N')
    expect(inputFromFormState(s)).toMatchObject({ type: 'INFO', frequency: 'UP_TO_N', maxDisplays: 3, stopAfterAnswer: true, situations: [] })
  })
})

describe('aller-retour du ciblage', () => {
  const full = () => modal({
    frequency: 'EVERY_N_DAYS', frequencyDays: 7, stopAfterAnswer: false, allowDontShowAgain: true, priority: 5, connectedOnly: true,
    conditions: ciRule(), minAppVersion: '1.0.6', maxAppVersion: '1.2.0', platforms: ['ANDROID'], samplePercent: 50,
    situations: [{ kind: 'OFFER_ACCEPTED_UNPAID', value: 6 }, { kind: 'PROFILE_INCOMPLETE', value: null }],
  })

  it('reprend tous les champs, puis les renvoie à l’identique', () => {
    const body = inputFromFormState(formStateFromModal(full()))
    expect(body).toMatchObject({
      frequency: 'EVERY_N_DAYS', frequencyDays: 7, stopAfterAnswer: false, allowDontShowAgain: true, priority: 5, connectedOnly: true,
      conditions: ciRule(), minAppVersion: '1.0.6', maxAppVersion: '1.2.0', platforms: ['ANDROID'], samplePercent: 50,
      situations: [{ kind: 'OFFER_ACCEPTED_UNPAID', value: 6 }, { kind: 'PROFILE_INCOMPLETE', value: null }],
    })
  })

  it('« tous les N jours » : les jours ne partent que pour cette fréquence', () => {
    const s = formStateFromModal(full())
    expect(inputFromFormState(s).frequencyDays).toBe(7)
    expect(inputFromFormState({ ...s, frequency: 'EVERY_OPEN' }).frequencyDays).toBeNull()
    expect(inputFromFormState({ ...s, frequencyDays: '' }).frequencyDays).toBeNaN()
    expect(inputFromFormState({ ...s, frequencyDays: '12' }).frequencyDays).toBe(12)
  })

  it('« une seule fois » envoie le plafond 1, quelle que soit la saisie', () => {
    const s = formStateFromModal(full())
    expect(inputFromFormState({ ...s, frequency: 'ONCE', maxDisplays: 7 }).maxDisplays).toBe(1)
    expect(inputFromFormState({ ...s, frequency: 'UP_TO_N', maxDisplays: 7 }).maxDisplays).toBe(7)
    expect(inputFromFormState({ ...s, frequency: 'EVERY_OPEN', maxDisplays: 7 }).maxDisplays).toBe(7)
  })

  it('priorité vide = 0, texte illisible = NaN (refusé par la validation)', () => {
    const s = formStateFromModal(full())
    expect(inputFromFormState({ ...s, priority: '' }).priority).toBe(0)
    expect(inputFromFormState({ ...s, priority: '3' }).priority).toBe(3)
    expect(inputFromFormState({ ...s, priority: 'x' }).priority).toBeNaN()
  })

  it('versions rognées, vides = null ; tirage en nombre, vide = NaN', () => {
    const s = formStateFromModal(full())
    const body = inputFromFormState({ ...s, minAppVersion: ' 1.0.6 ', maxAppVersion: '  ', samplePercent: '40' })
    expect(body.minAppVersion).toBe('1.0.6')
    expect(body.maxAppVersion).toBeNull()
    expect(body.samplePercent).toBe(40)
    expect(inputFromFormState({ ...s, samplePercent: '' }).samplePercent).toBeNaN()
    expect(inputFromFormState({ ...s, samplePercent: 'abc' }).samplePercent).toBeNaN()
  })

  it('situations : valeur numérique pour les heures et jours, null sinon ; saisie vide = null', () => {
    const s = formStateFromModal(full())
    s.situations = [
      { kind: 'COUNTER_OFFER_PENDING', value: '24' }, { kind: 'KYC_ABANDONED', value: 9 },
      { kind: 'RETURN_AFTER_ABSENCE', value: '' }, { kind: 'OFFER_UNANSWERED', value: 'x' },
    ]
    expect(inputFromFormState(s).situations).toEqual([
      { kind: 'COUNTER_OFFER_PENDING', value: 24 }, { kind: 'KYC_ABANDONED', value: null },
      { kind: 'RETURN_AFTER_ABSENCE', value: null }, { kind: 'OFFER_UNANSWERED', value: Number.NaN },
    ])
  })

  it('le système est copié, pas partagé avec la campagne', () => {
    const m = full()
    const s = formStateFromModal(m)
    s.platforms.push('IOS')
    expect(m.platforms).toEqual(['ANDROID'])
  })
})

describe('normalizeConditions', () => {
  it('sans condition (null, absent, groupe vide, forme inattendue) : null', () => {
    for (const c of [null, undefined, {}, { op: 'AND', children: [] }, { op: 'AND', children: 'x' }, 'x']) {
      expect(normalizeConditions(c), JSON.stringify(c)).toBeNull()
    }
  })
  it('avec condition : l’arbre tel quel', () => {
    expect(normalizeConditions(ciRule())).toEqual(ciRule())
  })
})

describe('frequencyLabel', () => {
  it('dit la fréquence en quelques mots', () => {
    expect(frequencyLabel({ frequency: 'ONCE', maxDisplays: 1 })).toBe('Une seule fois')
    expect(frequencyLabel({ frequency: 'UP_TO_N', maxDisplays: 1 })).toBe('Une seule fois')
    expect(frequencyLabel({ frequency: 'UP_TO_N', maxDisplays: 3 })).toBe('Jusqu’à 3 fois')
    expect(frequencyLabel({ maxDisplays: 5 })).toBe('Jusqu’à 5 fois')
    expect(frequencyLabel({ frequency: 'EVERY_OPEN', maxDisplays: 3 })).toBe('À chaque ouverture')
    expect(frequencyLabel({ frequency: 'EVERY_N_DAYS', maxDisplays: 3, frequencyDays: 7 })).toBe('Tous les 7 jours')
    expect(frequencyLabel({ frequency: 'EVERY_N_DAYS', maxDisplays: 3, frequencyDays: 1 })).toBe('Chaque jour')
    expect(frequencyLabel({ frequency: 'EVERY_N_DAYS', maxDisplays: 3 })).toBe('Tous les … jours')
    expect(frequencyLabel({ frequency: 'AUTRE' as never, maxDisplays: 3 })).toBe('AUTRE')
    expect(frequencyLabel({ frequency: 'UP_TO_N' } as never)).toBe('Jusqu’à 3 fois')
  })
})
