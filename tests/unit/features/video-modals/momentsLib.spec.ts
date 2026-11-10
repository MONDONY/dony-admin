import { describe, it, expect } from 'vitest'
import { defaultFormState, formStateFromModal, inputFromFormState } from '@/features/video-modals/lib/form'
import { hasErrors, validateVideoModal } from '@/features/video-modals/lib/validation'
import { buildSummary, summaryText, type SummaryInput } from '@/features/video-modals/lib/summary'
import {
  CORRIDOR_TRIGGERS, MOMENT_GROUPS, MOMENT_TRIGGERS, TRIGGER_CHIP_LABELS, TRIGGER_LABELS, TRIGGER_SHORT_LABELS, VIDEO_MODAL_TRIGGERS,
  isMomentTrigger, type VideoModalInput, type VideoModalTrigger,
} from '@/features/video-modals/types/index'
import { audienceFields, infoInput, infoModal, modal, validInput } from './fixtures'

describe('déclencheurs de l’étape 2 : valeurs du contrat', () => {
  it('treize valeurs d’enum, exactement celles du back, en plus des huit existantes', () => {
    expect([...MOMENT_TRIGGERS].sort()).toEqual([
      'APP_UPDATED', 'DELIVERY_CONFIRMED', 'FAVORITE_ADDED', 'FORM_ABANDONED', 'KYC_VERIFIED', 'PAYMENT_FAILED', 'PAYMENT_SUCCEEDED',
      'REQUEST_PUBLISHED', 'SEARCH_FEW_RESULTS', 'SEARCH_NO_PARCEL_RESULTS', 'SEARCH_NO_TRIP_RESULTS', 'TRIP_PUBLISHED', 'TRIP_VIEWED_REPEATEDLY',
    ])
    expect(VIDEO_MODAL_TRIGGERS).toHaveLength(21)
    expect(isMomentTrigger('PAYMENT_FAILED')).toBe(true)
    expect(isMomentTrigger('SEARCH_TAB')).toBe(false)
  })

  it('chaque valeur a un libellé de formulaire, de liste et un libellé complet ; chaque moment est dans une famille', () => {
    for (const t of VIDEO_MODAL_TRIGGERS) {
      expect(TRIGGER_CHIP_LABELS[t], t).toBeTruthy()
      expect(TRIGGER_SHORT_LABELS[t], t).toBeTruthy()
      expect(TRIGGER_LABELS[t], t).toBeTruthy()
    }
    expect([...MOMENT_GROUPS.ACTION, ...MOMENT_GROUPS.SEARCH, ...MOMENT_GROUPS.PAYMENT, ...MOMENT_GROUPS.ACCOUNT].sort()).toEqual([...MOMENT_TRIGGERS].sort())
  })

  it('le corridor concerne recherche, favori, consultation, formulaire abandonné, trajet et demande publiés, pas le reste', () => {
    const expected: VideoModalTrigger[] = [
      'SEARCH_NO_TRIP_RESULTS', 'SEARCH_NO_PARCEL_RESULTS', 'SEARCH_FEW_RESULTS', 'FAVORITE_ADDED', 'FORM_ABANDONED',
      'TRIP_VIEWED_REPEATEDLY', 'TRIP_PUBLISHED', 'REQUEST_PUBLISHED',
    ]
    expect([...CORRIDOR_TRIGGERS].sort()).toEqual([...expected].sort())
    for (const t of ['PAYMENT_FAILED', 'APP_UPDATED', 'KYC_VERIFIED', 'DELIVERY_CONFIRMED', 'PAYMENT_SUCCEEDED', 'PUBLISH_TRIP', 'APP_OPEN'] as const) {
      expect(CORRIDOR_TRIGGERS.includes(t), t).toBe(false)
    }
  })
})

describe('formulaire : seuils et corridors', () => {
  it('défauts : 2 et 3, aucun corridor ; corps valide pour le back', () => {
    const s = defaultFormState(['SEARCH_TAB'], 'VIDEO')
    expect(s.triggerOptions).toEqual({ fewResultsMax: 2, tripViewedTimes: 3 })
    expect(s.corridors).toEqual([])
    expect(inputFromFormState(s)).toMatchObject({ triggerOptions: { fewResultsMax: 2, tripViewedTimes: 3 }, corridors: [] })
    expect(inputFromFormState(defaultFormState(['SEARCH_TAB'], 'INFO'))).toMatchObject({ triggerOptions: { fewResultsMax: 2, tripViewedTimes: 3 }, corridors: [] })
  })

  it('campagne d’avant les moments (ni triggerOptions ni corridors) : défauts, aucun corridor, rien de cassé', () => {
    const s = formStateFromModal(modal())
    expect(s.triggerOptions).toEqual({ fewResultsMax: 2, tripViewedTimes: 3 })
    expect(s.corridors).toEqual([])
    expect(inputFromFormState(formStateFromModal(infoModal()))).toMatchObject({ type: 'INFO', corridors: [], triggerOptions: { fewResultsMax: 2, tripViewedTimes: 3 } })
    expect(formStateFromModal(modal({ triggerOptions: { fewResultsMax: 7 } as never })).triggerOptions).toEqual({ fewResultsMax: 7, tripViewedTimes: 3 })
  })

  it('aller-retour : seuils et corridors repris puis renvoyés, un côté vide devient null', () => {
    const m = modal({
      triggers: ['SEARCH_FEW_RESULTS', 'TRIP_VIEWED_REPEATEDLY', 'FAVORITE_ADDED'],
      triggerOptions: { fewResultsMax: 5, tripViewedTimes: 4 },
      corridors: [{ from: 'Paris', to: 'Abidjan' }, { from: null, to: 'Dakar' }, { from: 'Lyon', to: null }],
    })
    const s = formStateFromModal(m)
    expect(s.corridors).toEqual([{ from: 'Paris', to: 'Abidjan' }, { from: '', to: 'Dakar' }, { from: 'Lyon', to: '' }])
    const body = inputFromFormState(s)
    expect(body.triggerOptions).toEqual({ fewResultsMax: 5, tripViewedTimes: 4 })
    expect(body.corridors).toEqual(m.corridors)
    expect(body.triggers).toEqual(['SEARCH_FEW_RESULTS', 'TRIP_VIEWED_REPEATEDLY', 'FAVORITE_ADDED'])
  })

  it('textes rognés', () => {
    const s = defaultFormState(['TRIP_PUBLISHED'])
    s.corridors = [{ from: '  Paris ', to: ' ' }]
    expect(inputFromFormState(s).corridors).toEqual([{ from: 'Paris', to: null }])
  })

  it('moment coché : la saisie part telle quelle, NaN si illisible (la validation refuse)', () => {
    const s = defaultFormState(['SEARCH_FEW_RESULTS', 'TRIP_VIEWED_REPEATEDLY'])
    s.triggerOptions = { fewResultsMax: '25', tripViewedTimes: 'abc' }
    const body = inputFromFormState(s)
    expect(body.triggerOptions!.fewResultsMax).toBe(25)
    expect(body.triggerOptions!.tripViewedTimes).toBeNaN()
    s.triggerOptions = { fewResultsMax: '', tripViewedTimes: 1 }
    expect(inputFromFormState(s).triggerOptions!.fewResultsMax).toBeNaN()
  })

  it('moment décoché : valeur valable gardée, valeur invalide ramenée au défaut (jamais de refus pour une valeur cachée)', () => {
    const s = defaultFormState(['SEARCH_TAB'])
    s.triggerOptions = { fewResultsMax: 9, tripViewedTimes: 4 }
    expect(inputFromFormState(s).triggerOptions).toEqual({ fewResultsMax: 9, tripViewedTimes: 4 })
    s.triggerOptions = { fewResultsMax: 99, tripViewedTimes: '' }
    expect(inputFromFormState(s).triggerOptions).toEqual({ fewResultsMax: 2, tripViewedTimes: 3 })
    const errors = validateVideoModal(inputFromFormState(s))
    expect([errors.fewResultsMax, errors.tripViewedTimes]).toEqual([undefined, undefined])
  })
})

const withOptions = (over: Partial<VideoModalInput>) => validInput(over)

describe('validation : seuils et corridors (mêmes bornes que le back)', () => {
  it('seuil de peu de résultats : entier de 1 à 20', () => {
    for (const v of [1, 2, 20]) expect(validateVideoModal(withOptions({ triggerOptions: { fewResultsMax: v, tripViewedTimes: 3 } })).fewResultsMax, String(v)).toBeUndefined()
    for (const v of [0, 21, 1.5, Number.NaN, -3]) {
      expect(validateVideoModal(withOptions({ triggerOptions: { fewResultsMax: v, tripViewedTimes: 3 } })).fewResultsMax, String(v)).toBe('Nombre entier, de 1 à 20.')
    }
  })

  it('consultations du même trajet : entier de 2 à 10', () => {
    for (const v of [2, 3, 10]) expect(validateVideoModal(withOptions({ triggerOptions: { fewResultsMax: 2, tripViewedTimes: v } })).tripViewedTimes, String(v)).toBeUndefined()
    for (const v of [1, 11, 2.5, Number.NaN, 0]) {
      expect(validateVideoModal(withOptions({ triggerOptions: { fewResultsMax: 2, tripViewedTimes: v } })).tripViewedTimes, String(v)).toBe('Nombre entier, de 2 à 10.')
    }
  })

  it('sans triggerOptions (ancien corps) : aucune erreur', () => {
    const errors = validateVideoModal(validInput())
    expect(errors.fewResultsMax).toBeUndefined()
    expect(errors.tripViewedTimes).toBeUndefined()
    expect(errors.corridors).toBeUndefined()
  })

  it('un moment de l’étape 2 suffit comme déclencheur', () => {
    expect(validateVideoModal(validInput({ triggers: ['PAYMENT_FAILED'] })).triggers).toBeUndefined()
    expect(validateVideoModal(validInput({ triggers: [] })).triggers).toContain('au moins un endroit')
    expect(validateVideoModal(validInput({ triggers: ['PAYMENT_FAILED', 'NOPE' as VideoModalTrigger] })).triggers).toBeUndefined()
  })

  it('corridors : zéro à dix, un côté peut rester vide', () => {
    expect(validateVideoModal(validInput({ corridors: [] })).corridors).toBeUndefined()
    expect(validateVideoModal(validInput({ corridors: [{ from: 'Paris', to: null }, { from: null, to: 'Dakar' }, { from: 'Lyon', to: 'Bamako' }] })).corridors).toBeUndefined()
    const ten = Array.from({ length: 10 }, (_, i) => ({ from: `V${i}`, to: null }))
    expect(validateVideoModal(validInput({ corridors: ten })).corridors).toBeUndefined()
    expect(validateVideoModal(validInput({ corridors: [...ten, { from: 'Z', to: null }] })).corridors).toBe('10 trajets ou colis au plus.')
  })

  it('corridors : 80 caractères au plus par côté (rognés)', () => {
    const ok = 'a'.repeat(80)
    expect(validateVideoModal(validInput({ corridors: [{ from: ok, to: `  ${ok}  ` }] })).corridors).toBeUndefined()
    expect(validateVideoModal(validInput({ corridors: [{ from: `${ok}b`, to: null }] })).corridors).toContain('80 caractères')
    expect(validateVideoModal(validInput({ corridors: [{ from: 'Paris', to: 'b'.repeat(81) }] })).corridors).toContain('80 caractères')
  })

  it('corridors : une ligne sans aucun côté est refusée', () => {
    expect(validateVideoModal(validInput({ corridors: [{ from: null, to: null }] })).corridors).toContain('au moins le départ ou l’arrivée')
    expect(validateVideoModal(validInput({ corridors: [{ from: '  ', to: '' }] })).corridors).toContain('au moins le départ ou l’arrivée')
  })

  it('mêmes règles pour un modal Information', () => {
    expect(validateVideoModal(infoInput({ triggerOptions: { fewResultsMax: 0, tripViewedTimes: 3 }, corridors: [{ from: null, to: null }] }))).toMatchObject({
      fewResultsMax: expect.any(String), corridors: expect.any(String),
    })
    expect(hasErrors(validateVideoModal(infoInput({ triggers: ['KYC_VERIFIED'], triggerOptions: { fewResultsMax: 2, tripViewedTimes: 3 }, corridors: [] })))).toBe(false)
  })
})

const base = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  triggers: ['SEARCH_TAB'], situations: [], connectedOnly: false, conditions: null, minAppVersion: null, maxAppVersion: null, platforms: [],
  samplePercent: 100, frequency: 'ONCE', frequencyDays: null, maxDisplays: 1, stopAfterAnswer: true, allowDontShowAgain: false,
  startsAt: null, endsAt: null, ...over,
})
const text = (over: Partial<SummaryInput> = {}) => summaryText(buildSummary(base(over), audienceFields))

describe('phrase « En clair » : moments d’action et corridors', () => {
  it.each([
    ['DELIVERY_CONFIRMED', 'une livraison confirmée'],
    ['PAYMENT_SUCCEEDED', 'un paiement réussi'],
    ['TRIP_PUBLISHED', 'la publication d’un trajet'],
    ['REQUEST_PUBLISHED', 'la publication d’une demande d’envoi'],
    ['KYC_VERIFIED', 'la vérification de l’identité'],
    ['SEARCH_NO_TRIP_RESULTS', 'une recherche de trajet sans résultat'],
    ['SEARCH_NO_PARCEL_RESULTS', 'une recherche de colis sans résultat'],
    ['FAVORITE_ADDED', 'l’ajout d’un trajet ou d’une alerte aux favoris'],
    ['FORM_ABANDONED', 'un formulaire de trajet ou de demande quitté sans publier'],
    ['PAYMENT_FAILED', 'un paiement échoué ou annulé'],
    ['APP_UPDATED', 'la première ouverture après une mise à jour de l’app'],
  ] as const)('%s : 2 secondes après %s', (trigger, phrase) => {
    expect(text({ triggers: [trigger] })).toContain(`Ce modal s’ouvrira 2 secondes après ${phrase}`)
  })

  it('peu de résultats : seuil en clair (défaut 2, un seul résultat, valeur choisie)', () => {
    expect(text({ triggers: ['SEARCH_FEW_RESULTS'] })).toContain('une recherche qui renvoie de 1 à 2 résultats')
    expect(text({ triggers: ['SEARCH_FEW_RESULTS'], triggerOptions: { fewResultsMax: 5, tripViewedTimes: 3 } })).toContain('de 1 à 5 résultats')
    expect(text({ triggers: ['SEARCH_FEW_RESULTS'], triggerOptions: { fewResultsMax: 1, tripViewedTimes: 3 } })).toContain('une recherche qui ne renvoie qu’un seul résultat')
    expect(text({ triggers: ['SEARCH_FEW_RESULTS'], triggerOptions: { fewResultsMax: Number.NaN, tripViewedTimes: 3 } })).toContain('de 1 à 2 résultats')
  })

  it('même trajet consulté : nombre de fois en clair (défaut 3)', () => {
    expect(text({ triggers: ['TRIP_VIEWED_REPEATEDLY'] })).toContain('la consultation du même trajet 3 fois')
    expect(text({ triggers: ['TRIP_VIEWED_REPEATEDLY'], triggerOptions: { fewResultsMax: 2, tripViewedTimes: 6 } })).toContain('du même trajet 6 fois')
  })

  it('un moment avec un écran et un bouton : tous décrits, avec et sans délai', () => {
    const t = text({ triggers: ['SEARCH_TAB', 'PAYMENT_FAILED', 'PUBLISH_TRIP'] })
    expect(t).toContain('2 secondes après l’arrivée sur l’onglet Rechercher ou un paiement échoué ou annulé, ou dès le toucher du bouton « Publier un trajet », sans délai')
  })

  it('corridors : de A vers B, au départ de, à l’arrivée à, plusieurs séparés par « ou »', () => {
    const corridors = [{ from: 'Paris', to: 'Abidjan' }, { from: 'Lyon', to: null }, { from: null, to: 'Dakar' }]
    expect(text({ triggers: ['SEARCH_NO_TRIP_RESULTS'], corridors }))
      .toContain('2 secondes après une recherche de trajet sans résultat, seulement pour un trajet ou un colis de Paris vers Abidjan, au départ de Lyon ou à l’arrivée à Dakar')
    expect(text({ triggers: ['FAVORITE_ADDED'], corridors: [{ from: 'Abidjan', to: 'Paris' }] })).toContain('d’Abidjan vers Paris')
    expect(text({ triggers: ['FAVORITE_ADDED'], corridors: [{ from: 'Île-de-France', to: null }] })).toContain('au départ d’Île-de-France')
  })

  it('corridors sans moment concerné coché : non mentionnés (sans effet), ni lignes vides', () => {
    expect(text({ triggers: ['PAYMENT_FAILED', 'SEARCH_TAB'], corridors: [{ from: 'Paris', to: null }] })).not.toContain('seulement pour un trajet')
    expect(text({ triggers: ['TRIP_PUBLISHED'], corridors: [] })).not.toContain('seulement pour un trajet')
    expect(text({ triggers: ['TRIP_PUBLISHED'], corridors: [{ from: null, to: null }] })).not.toContain('seulement pour un trajet')
  })

  it('ordre de la phrase : moment, corridors, public, puis fréquence', () => {
    const t = text({ triggers: ['SEARCH_NO_PARCEL_RESULTS'], corridors: [{ from: 'Paris', to: null }], connectedOnly: true })
    expect(t.indexOf('seulement pour un trajet')).toBeLessThan(t.indexOf('uniquement pour les personnes connectées'))
    expect(t.indexOf('uniquement pour les personnes connectées')).toBeLessThan(t.indexOf('Il s’affichera'))
  })
})
