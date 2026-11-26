import { describe, it, expect } from 'vitest'
import { buildDisplayConditions } from '@/features/video-modals/lib/displayConditions'
import { validateVideoModal } from '@/features/video-modals/lib/validation'
import { defaultFormState, inputFromFormState } from '@/features/video-modals/lib/form'
import { buildSummary, summaryText } from '@/features/video-modals/lib/summary'
import { parcelScreenShown, withParcelExamples } from '@/features/video-modals/lib/parcelPreview'
import { infoInput } from './fixtures'
import type { VideoModalInput } from '@/features/video-modals/types/index'

const now = new Date('2026-11-14T12:00:00Z')
const rows = (i: VideoModalInput) => buildDisplayConditions(i, { active: true, now, errors: validateVideoModal(i) })
const row = (i: VideoModalInput, id: string) => rows(i).rows.find(r => r.id === id)
const parcel = (over: Partial<VideoModalInput> = {}) => infoInput({ triggers: ['PARCEL_ARRIVED'], ...over })
const text = (i: Partial<VideoModalInput>) => summaryText(buildSummary({ ...infoInput(), ...i } as never, []))

describe('I4 : conditions d’affichage des étapes du colis', () => {
  it('ONCE_PER_PARCEL : branche dédiée, pas « sans plafond », jamais « bouton touché »', () => {
    const i = parcel({ frequency: 'ONCE_PER_PARCEL', stopAfterAnswer: true })
    expect(row(i, 'frequency')?.detail).toContain('Une seule fois par colis')
    expect(row(i, 'frequency')?.detail).not.toContain('Sans plafond')
    expect(row(i, 'stop-after-answer')?.detail).toContain('Sans effet')
    expect(rows(i).common.join(' ')).toContain('« Une fois par colis » n’est pas limitée à un par lancement')
  })
  it('étape du colis : app qui connaît les étapes, pas « 1.0.6 et plus » seul ; rôles ; visiteurs', () => {
    const i = parcel({ parcelRoles: ['TRAVELER'] })
    expect(row(i, 'parcel-capability')?.detail).toContain('étapes du colis')
    expect(row(i, 'app-version')?.detail).not.toContain('moment d’action')
    expect(row(i, 'parcel-roles')?.detail).toContain('Voyageur')
    expect(row(i, 'parcel-visitors')?.verdict).toBe('check')
    expect(row(infoInput({ triggers: ['SEARCH_TAB'] }), 'parcel-capability')).toBeUndefined()
  })
  it('mixte : ligne à vérifier ; ONCE_PER_PARCEL mixte : bloque', () => {
    expect(row(parcel({ triggers: ['PARCEL_ARRIVED', 'SEARCH_TAB'] }), 'parcel-mixed')?.verdict).toBe('check')
    expect(row(parcel({ triggers: ['PARCEL_ARRIVED', 'SEARCH_TAB'], frequency: 'ONCE_PER_PARCEL' }), 'once-per-parcel')?.verdict).toBe('block')
    expect(row(parcel({ frequency: 'ONCE_PER_PARCEL' }), 'once-per-parcel')).toBeUndefined()
  })
})

describe('I3, I1, M2 : résumé', () => {
  it('ONCE_PER_PARCEL sans « ne revient plus après un bouton touché »', () => {
    expect(text({ triggers: ['PARCEL_ARRIVED'], frequency: 'ONCE_PER_PARCEL', stopAfterAnswer: true })).not.toContain('bouton touché')
    expect(text({ triggers: ['PARCEL_ARRIVED'], frequency: 'EVERY_OPEN', stopAfterAnswer: true })).toContain('bouton touché')
  })
  it('mixte : le rôle est rattaché aux étapes', () => {
    expect(text({ triggers: ['SEARCH_TAB', 'PARCEL_ARRIVED'], parcelRoles: ['TRAVELER'] })).toContain('pour le voyageur, à l’ouverture du colis')
    expect(text({ triggers: ['PARCEL_ARRIVED'], parcelRoles: ['TRAVELER'] })).toContain('pour le voyageur')
  })
  it('que des étapes du colis : pas « visiteurs sans compte compris »', () => {
    expect(text({ triggers: ['PARCEL_ARRIVED'], parcelRoles: [] })).not.toContain('visiteurs')
    expect(text({ triggers: ['SEARCH_TAB'] })).toContain('visiteurs sans compte compris')
  })
})

describe('I2 : parcelScreenShown', () => {
  it('miroir de canRun', () => {
    expect(parcelScreenShown('PARCEL_QR', 'SENDER')).toBe(true)
    expect(parcelScreenShown('PARCEL_QR', 'TRAVELER')).toBe(false)
    expect(parcelScreenShown('PARCEL_SEND_CODE', 'SENDER')).toBe(true)
    expect(parcelScreenShown('PARCEL_SEND_CODE', 'SENDER', { codeExists: false })).toBe(false)
    expect(parcelScreenShown('PARCEL_SEND_CODE', 'RECIPIENT')).toBe(false)
    expect(parcelScreenShown('PARCEL_DETAIL', 'RECIPIENT')).toBe(true)
    expect(parcelScreenShown('PARCEL_TRACKING', 'TRAVELER')).toBe(true)
    expect(parcelScreenShown('SEARCH', 'RECIPIENT')).toBe(true)
  })
  it('exemples : une seule table, rôle inconnu toléré', () => {
    expect(withParcelExamples('{voyageur}')).toBe('Awa')
    expect(withParcelExamples('{voyageur}')).toBe('Awa')
  })
})

describe('M1 et M4', () => {
  it('rôle inconnu : ne bloque pas l’enregistrement', () => {
    expect(validateVideoModal(parcel({ parcelRoles: ['COURIER' as never] })).parcelRoles).toBeUndefined()
  })
  it('déclencheur inconnu : les rôles sont gardés', () => {
    const s = { ...defaultFormState(['FUTURE_STEP' as never], 'INFO'), parcelRoles: ['COURIER' as never] }
    expect(inputFromFormState(s).parcelRoles).toEqual(['COURIER'])
  })
  it('NFC sur titres et corps : {expéditeur} décomposé accepté', () => {
    const nfd = '{expéditeur}'
    const s = { ...defaultFormState(['PARCEL_ARRIVED'], 'INFO'), titleFr: nfd, bodyFr: nfd, titleEn: nfd, bodyEn: nfd }
    const input = inputFromFormState(s)
    expect(input.titleFr).toBe('{expéditeur}')
    expect(input.bodyEn).toBe('{expéditeur}')
  })
})
