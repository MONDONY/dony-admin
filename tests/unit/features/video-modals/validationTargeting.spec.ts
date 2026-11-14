import { describe, it, expect } from 'vitest'
import { validateVideoModal } from '@/features/video-modals/lib/validation'
import type { VideoModalInput } from '@/features/video-modals/types/index'
import { infoInput, validInput } from './fixtures'

const both: Array<[string, (_o?: Partial<VideoModalInput>) => VideoModalInput]> = [['vidéo', validInput], ['information', infoInput]]

describe.each(both)('validation du ciblage : %s', (_label, make) => {
  it('sans aucun champ de ciblage (back plus ancien) : valide comme avant', () => {
    expect(validateVideoModal(make())).toEqual({})
  })

  it('réglages complets valides', () => {
    const input = make({
      frequency: 'EVERY_N_DAYS', frequencyDays: 7, stopAfterAnswer: false, allowDontShowAgain: true, priority: -2,
      connectedOnly: true, minAppVersion: '1.0.6', maxAppVersion: '1.10.0', platforms: ['ANDROID', 'IOS'], samplePercent: 50,
      conditions: { op: 'AND', children: [{ field: 'country', operator: 'IS', value: 'CI' }] },
      situations: [{ kind: 'OFFER_ACCEPTED_UNPAID', value: 6 }, { kind: 'PROFILE_INCOMPLETE', value: null }],
    })
    expect(validateVideoModal(input)).toEqual({})
  })

  it('fréquence inconnue : refusée', () => {
    expect(validateVideoModal(make({ frequency: 'SOMETIMES' as never })).frequency).toContain('liste')
  })

  it('« tous les N jours » : N entier de 1 à 365', () => {
    for (const days of [undefined, null, 0, 366, 1.5, Number.NaN]) {
      expect(validateVideoModal(make({ frequency: 'EVERY_N_DAYS', frequencyDays: days as never })).frequencyDays, String(days)).toContain('1 à 365')
    }
    for (const days of [1, 7, 365]) {
      expect(validateVideoModal(make({ frequency: 'EVERY_N_DAYS', frequencyDays: days })).frequencyDays, String(days)).toBeUndefined()
    }
  })

  it('« à chaque fois » : permise seulement avec des moments d’action', () => {
    const ok = validateVideoModal(make({ frequency: 'EVERY_TIME', frequencyDays: null, triggers: ['SEARCH_NO_TRIP_RESULTS', 'PAYMENT_SUCCEEDED'] }))
    expect(ok.frequency).toBeUndefined()
    for (const screen of ['APP_OPEN', 'SEARCH_TAB', 'ACTIVITIES_TAB', 'TRACKING_TAB', 'MESSAGES_TAB', 'PROFILE_TAB', 'PUBLISH_TRIP', 'SEND_PARCEL']) {
      const e = validateVideoModal(make({ frequency: 'EVERY_TIME', frequencyDays: null, triggers: ['PAYMENT_SUCCEEDED', screen as never] }))
      expect(e.frequency, screen).toBe('Cette fréquence ne s’applique qu’aux moments d’action : retire les déclencheurs d’écran ou de bouton.')
    }
    expect(validateVideoModal(make({ frequency: 'EVERY_OPEN', triggers: ['APP_OPEN'] })).frequency).toBeUndefined()
  })

  it('« à chaque fois » : la date de fin reste facultative', () => {
    const e = validateVideoModal(make({ frequency: 'EVERY_TIME', frequencyDays: null, triggers: ['PAYMENT_FAILED'], endsAt: null }))
    expect(e).toEqual({})
  })

  it('les jours ne comptent que pour « tous les N jours »', () => {
    expect(validateVideoModal(make({ frequency: 'EVERY_OPEN', frequencyDays: null })).frequencyDays).toBeUndefined()
    expect(validateVideoModal(make({ frequency: 'ONCE', frequencyDays: 999 })).frequencyDays).toBeUndefined()
  })

  it('priorité : entier, négatif accepté', () => {
    expect(validateVideoModal(make({ priority: 1.5 })).priority).toContain('entier')
    expect(validateVideoModal(make({ priority: Number.NaN })).priority).toContain('entier')
    expect(validateVideoModal(make({ priority: -3 })).priority).toBeUndefined()
    expect(validateVideoModal(make({ priority: 0 })).priority).toBeUndefined()
  })

  it('versions : x.y.z, minimale pas après la maximale (comparaison numérique)', () => {
    expect(validateVideoModal(make({ minAppVersion: '1.0' })).minAppVersion).toContain('1.2.3')
    expect(validateVideoModal(make({ maxAppVersion: 'a.b.c' })).maxAppVersion).toContain('1.2.3')
    expect(validateVideoModal(make({ minAppVersion: '1.0.6.1' })).minAppVersion).toBeDefined()
    expect(validateVideoModal(make({ minAppVersion: '1.10.0', maxAppVersion: '1.9.0' })).maxAppVersion).toContain('au moins égale')
    expect(validateVideoModal(make({ minAppVersion: '2.0.0', maxAppVersion: '1.9.9' })).maxAppVersion).toBeDefined()
    expect(validateVideoModal(make({ minAppVersion: '1.0.7', maxAppVersion: '1.0.6' })).maxAppVersion).toBeDefined()
    expect(validateVideoModal(make({ minAppVersion: '1.9.0', maxAppVersion: '1.10.0' }))).toEqual({})
    expect(validateVideoModal(make({ minAppVersion: '1.0.6', maxAppVersion: '1.0.6' }))).toEqual({})
    expect(validateVideoModal(make({ minAppVersion: ' ', maxAppVersion: null }))).toEqual({})
  })

  it('une version mal formée n’ajoute pas d’erreur de comparaison', () => {
    const e = validateVideoModal(make({ minAppVersion: 'x', maxAppVersion: '1.0.0' }))
    expect(e.minAppVersion).toBeDefined()
    expect(e.maxAppVersion).toBeUndefined()
  })

  it('système inconnu : refusé', () => {
    expect(validateVideoModal(make({ platforms: ['WINDOWS' as never] })).platforms).toContain('inconnu')
    expect(validateVideoModal(make({ platforms: [] })).platforms).toBeUndefined()
  })

  it('tirage : entier de 1 à 100', () => {
    for (const p of [0, 101, 50.5, Number.NaN, -1]) {
      expect(validateVideoModal(make({ samplePercent: p })).samplePercent, String(p)).toContain('1 à 100')
    }
    for (const p of [1, 50, 100]) expect(validateVideoModal(make({ samplePercent: p })).samplePercent, String(p)).toBeUndefined()
  })

  it('situations : valeur dans les bornes, une seule fois chacune, type connu', () => {
    const one = (kind: string, value: number | null) => validateVideoModal(make({ situations: [{ kind, value } as never] })).situations
    expect(one('OFFER_ACCEPTED_UNPAID', 0)).toContain('1 à 720')
    expect(one('OFFER_ACCEPTED_UNPAID', 721)).toContain('heures')
    expect(one('OFFER_UNANSWERED', 720)).toBeUndefined()
    expect(one('COUNTER_OFFER_PENDING', 1)).toBeUndefined()
    expect(one('RETURN_AFTER_ABSENCE', 366)).toContain('1 à 365')
    expect(one('RETURN_AFTER_ABSENCE', 366)).toContain('jours')
    expect(one('DAYS_SINCE_INSTALL_NO_ACTION', null)).toContain('Valeur')
    expect(one('DAYS_SINCE_INSTALL_NO_ACTION', Number.NaN)).toBeDefined()
    expect(one('DAYS_SINCE_INSTALL_NO_ACTION', 2.5)).toBeDefined()
    expect(one('KYC_ABANDONED', null)).toBeUndefined()
    expect(one('FIRST_DELIVERY_NO_REFERRAL', null)).toBeUndefined()
    expect(one('NOPE', 3)).toContain('inconnue')
    const dup = validateVideoModal(make({ situations: [{ kind: 'KYC_ABANDONED', value: null }, { kind: 'KYC_ABANDONED', value: null }] })).situations
    expect(dup).toContain('qu’une fois')
  })

  it('une situation tient lieu de déclencheur ; sans rien, refus', () => {
    expect(validateVideoModal(make({ triggers: [], situations: [{ kind: 'PROFILE_INCOMPLETE', value: null }] })).triggers).toBeUndefined()
    expect(validateVideoModal(make({ triggers: [], situations: [] })).triggers).toContain('au moins un endroit')
    expect(validateVideoModal(make({ triggers: [] })).triggers).toContain('une situation')
  })

  it('conditions incomplètes : refusées', () => {
    expect(validateVideoModal(make(), { conditionsComplete: false }).conditions).toContain('conditions incomplètes')
    expect(validateVideoModal(make(), { conditionsComplete: true }).conditions).toBeUndefined()
    expect(validateVideoModal(make()).conditions).toBeUndefined()
  })
})
