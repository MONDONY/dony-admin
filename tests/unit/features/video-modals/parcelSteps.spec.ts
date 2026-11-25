import { describe, it, expect } from 'vitest'
import { validateVideoModal } from '@/features/video-modals/lib/validation'
import { defaultFormState, formStateFromModal, inputFromFormState } from '@/features/video-modals/lib/form'
import { frequencyLabel, parcelRoleLabel, screenLabel, triggerLabel } from '@/features/video-modals/lib/labels'
import { buildSummary, summaryText, type SummaryInput } from '@/features/video-modals/lib/summary'
import {
  INFO_SCREEN_LABELS, INFO_SCREENS, MODAL_FREQUENCIES, PARCEL_ROLES, PARCEL_ROLE_LABELS, PARCEL_STEP_TRIGGERS, PARCEL_VARIABLES,
  TRIGGER_CHIP_LABELS, TRIGGER_LABELS, TRIGGER_SHORT_LABELS, VIDEO_MODAL_TRIGGERS, FREQUENCY_SHORT_LABELS,
  type VideoModalInput,
} from '@/features/video-modals/types/index'
import { audienceFields, infoInput, modal } from './fixtures'

const parcelInfo = (over: Partial<VideoModalInput> = {}) => infoInput({ triggers: ['PARCEL_ACCEPTED'], ...over })
const screenAction = (screen: string) => ({ kind: 'SCREEN' as const, screen: screen as never, url: null })

describe('validation des étapes du colis', () => {
  it('validation_acceptsAllowedPlaceholders', () => {
    const input = parcelInfo({
      titleFr: 'Colis pour {destinataire}', titleEn: 'Parcel for {destinataire}',
      bodyFr: '{voyageur} part vers {ville_arrivee}, {expéditeur} le sait.', bodyEn: '{voyageur} to {ville_arrivee}',
    })
    expect(validateVideoModal(input)).toEqual({})
  })

  it('validation_rejectsUnknownPlaceholder', () => {
    for (const bad of ['{code}', '{}', '{Destinataire}', '{ destinataire }']) {
      expect(validateVideoModal(parcelInfo({ titleFr: `Bonjour ${bad}` })).titleFr, bad).toContain('Variable inconnue')
      expect(validateVideoModal(parcelInfo({ bodyFr: `Texte ${bad}` })).bodyFr, bad).toContain('Variable inconnue')
      expect(validateVideoModal(parcelInfo({ titleEn: `Hi ${bad}` })).titleEn, bad).toContain('Variable inconnue')
      expect(validateVideoModal(parcelInfo({ bodyEn: `Text ${bad}` })).bodyEn, bad).toContain('Variable inconnue')
    }
    expect(validateVideoModal(parcelInfo({ bodyFr: 'Code {code}' })).bodyFr).toContain('{destinataire}, {voyageur}, {expéditeur}, {ville_arrivee}')
  })

  it('les variables ne sont contrôlées que dans les titres et textes, pas dans les sous-titres ni les boutons', () => {
    const e = validateVideoModal(parcelInfo({ subtitleFr: '{code}', subtitleEn: '{code}', primaryLabelFr: '{x}', primaryLabelEn: '{x}' }))
    expect(e.subtitleFr).toBeUndefined()
    expect(e.primaryLabelFr).toBeUndefined()
  })

  it('un modal vidéo contrôle aussi ses variables', () => {
    const e = validateVideoModal(modal({ titleFr: 'Salut {code}' }))
    expect(e.titleFr).toContain('Variable inconnue')
  })

  it('PARCEL_VARIABLES : l’ensemble exact', () => {
    expect([...PARCEL_VARIABLES]).toEqual(['{destinataire}', '{voyageur}', '{expéditeur}', '{ville_arrivee}'])
  })

  it('validation_rolesRequireParcelTrigger', () => {
    expect(validateVideoModal(parcelInfo({ triggers: ['SEARCH_TAB'], parcelRoles: ['SENDER'] })).parcelRoles).toContain('étape du colis')
    expect(validateVideoModal(parcelInfo({ parcelRoles: ['SENDER', 'RECIPIENT'] })).parcelRoles).toBeUndefined()
    expect(validateVideoModal(parcelInfo({ triggers: ['SEARCH_TAB'], parcelRoles: [] })).parcelRoles).toBeUndefined()
    expect(validateVideoModal(parcelInfo({ triggers: ['SEARCH_TAB'] })).parcelRoles).toBeUndefined()
    expect(validateVideoModal(parcelInfo({ parcelRoles: ['BOSS' as never] })).parcelRoles).toContain('inconnu')
  })

  it('validation_oncePerParcelRequiresOnlyParcelTriggers', () => {
    const ok = validateVideoModal(parcelInfo({ frequency: 'ONCE_PER_PARCEL', triggers: ['PARCEL_ACCEPTED', 'PARCEL_DELIVERED'] }))
    expect(ok.frequency).toBeUndefined()
    const mixed = validateVideoModal(parcelInfo({ frequency: 'ONCE_PER_PARCEL', triggers: ['PARCEL_ACCEPTED', 'PAYMENT_SUCCEEDED'] }))
    expect(mixed.frequency).toContain('étapes du colis')
    expect(validateVideoModal(parcelInfo({ frequency: 'ONCE_PER_PARCEL', triggers: [] })).frequency).toContain('étapes du colis')
    expect(validateVideoModal(parcelInfo({ frequency: 'ONCE_PER_PARCEL', triggers: ['APP_OPEN'] })).frequency).toContain('étapes du colis')
  })

  it('validation_parcelActionRequiresParcelTrigger', () => {
    for (const screen of ['PARCEL_DETAIL', 'PARCEL_QR', 'PARCEL_SEND_CODE', 'PARCEL_TRACKING']) {
      const bad = validateVideoModal(parcelInfo({ triggers: ['SEARCH_TAB'], primaryLabelFr: 'Ouvrir', primaryAction: screenAction(screen) }))
      expect(bad.primaryAction, screen).toContain('étape du colis')
      const badSec = validateVideoModal(parcelInfo({ triggers: ['SEARCH_TAB'], secondaryLabelFr: 'Plus', secondaryAction: screenAction(screen) }))
      expect(badSec.secondaryAction, screen).toContain('étape du colis')
      const ok = validateVideoModal(parcelInfo({ primaryLabelFr: 'Ouvrir', primaryAction: screenAction(screen), secondaryLabelFr: 'Plus', secondaryAction: screenAction(screen) }))
      expect(ok, screen).toEqual({})
    }
    expect(validateVideoModal(parcelInfo({ triggers: ['SEARCH_TAB'], primaryLabelFr: 'Suivi', primaryAction: screenAction('TRACKING') }))).toEqual({})
  })

  it('« à chaque fois » reste permise avec des étapes du colis (comme le back)', () => {
    expect(validateVideoModal(parcelInfo({ frequency: 'EVERY_TIME', frequencyDays: null })).frequency).toBeUndefined()
  })
})

describe('libellés', () => {
  it('labels_coverEveryNewWireValue', () => {
    expect(PARCEL_STEP_TRIGGERS).toEqual(['PARCEL_ACCEPTED', 'PARCEL_HANDED_OVER', 'PARCEL_IN_TRANSIT', 'PARCEL_ARRIVED', 'PARCEL_DELIVERED'])
    const frLabels = ['Colis accepté', 'Colis remis', 'Colis en voyage', 'Colis arrivé', 'Colis livré']
    PARCEL_STEP_TRIGGERS.forEach((t, i) => {
      expect(VIDEO_MODAL_TRIGGERS).toContain(t)
      expect(TRIGGER_LABELS[t]).toBe(frLabels[i])
      expect(TRIGGER_SHORT_LABELS[t]).toBe(frLabels[i])
      expect(TRIGGER_CHIP_LABELS[t]).toBe(frLabels[i])
      expect(triggerLabel(t)).toBe(frLabels[i])
    })
    expect(PARCEL_ROLES).toEqual(['SENDER', 'TRAVELER', 'RECIPIENT'])
    expect(PARCEL_ROLES.map(r => PARCEL_ROLE_LABELS[r])).toEqual(['Expéditeur', 'Voyageur', 'Destinataire'])
    expect(MODAL_FREQUENCIES).toContain('ONCE_PER_PARCEL')
    expect(FREQUENCY_SHORT_LABELS.ONCE_PER_PARCEL).toBe('Une fois par colis')
    expect(frequencyLabel({ frequency: 'ONCE_PER_PARCEL', maxDisplays: 3 })).toBe('Une fois par colis')
    const screens = { PARCEL_DETAIL: 'Ouvrir le colis', PARCEL_QR: 'Afficher le QR du colis', PARCEL_SEND_CODE: 'Envoyer le code de retrait', PARCEL_TRACKING: 'Ouvrir le suivi' }
    for (const [s, label] of Object.entries(screens)) {
      expect(INFO_SCREENS).toContain(s)
      expect((INFO_SCREEN_LABELS as Record<string, string>)[s]).toBe(label)
    }
    for (const s of INFO_SCREENS) expect(INFO_SCREEN_LABELS[s], s).toBeTruthy()
  })

  it('une valeur inconnue d’un back plus récent s’affiche telle quelle, sans lever d’erreur', () => {
    expect(triggerLabel('PARCEL_LOST')).toBe('PARCEL_LOST')
    expect(parcelRoleLabel('COURIER')).toBe('COURIER')
    expect(screenLabel('PARCEL_RETURN')).toBe('PARCEL_RETURN')
    expect(frequencyLabel({ frequency: 'WEEKLY' as never, maxDisplays: 1 })).toBe('WEEKLY')
  })
})

describe('formulaire et corps envoyé', () => {
  it('parcelRoles est toujours envoyé (tableau vide si aucun), jamais absent', () => {
    expect(inputFromFormState(defaultFormState()).parcelRoles).toEqual([])
    expect(inputFromFormState(defaultFormState(['SEARCH_TAB'], 'INFO')).parcelRoles).toEqual([])
    const s = { ...defaultFormState(['PARCEL_ARRIVED'], 'INFO'), parcelRoles: ['RECIPIENT' as const] }
    expect(inputFromFormState(s).parcelRoles).toEqual(['RECIPIENT'])
    expect(inputFromFormState({ ...s, type: 'VIDEO' }).parcelRoles).toEqual(['RECIPIENT'])
  })

  it('rôles envoyés vides quand plus aucune étape du colis n’est cochée (jamais de 422 pour un champ caché)', () => {
    const s = { ...defaultFormState(['SEARCH_TAB'], 'INFO'), parcelRoles: ['SENDER' as const] }
    expect(inputFromFormState(s).parcelRoles).toEqual([])
  })

  it('une campagne sans parcelRoles, avec null, ou avec une valeur inconnue : lue sans planter', () => {
    expect(formStateFromModal(modal()).parcelRoles).toEqual([])
    expect(formStateFromModal(modal({ parcelRoles: null as never })).parcelRoles).toEqual([])
    expect(formStateFromModal(modal({ parcelRoles: ['SENDER', 'COURIER' as never] })).parcelRoles).toEqual(['SENDER', 'COURIER'])
  })
})

describe('phrase « En clair »', () => {
  const base = (over: Partial<SummaryInput> = {}): SummaryInput => ({
    triggers: ['PARCEL_ACCEPTED'], situations: [], connectedOnly: false, conditions: null, minAppVersion: null, maxAppVersion: null, platforms: [],
    samplePercent: 100, frequency: 'ONCE_PER_PARCEL', frequencyDays: null, maxDisplays: 1, stopAfterAnswer: true, allowDontShowAgain: false,
    startsAt: null, endsAt: null, parcelRoles: [], ...over,
  })
  const text = (over: Partial<SummaryInput> = {}) => summaryText(buildSummary(base(over), audienceFields))

  it('summary_mentionsRoles', () => {
    expect(text({ parcelRoles: ['SENDER'] })).toContain('pour l’expéditeur')
    expect(text({ parcelRoles: ['SENDER', 'RECIPIENT'] })).toContain('pour l’expéditeur ou le destinataire')
    expect(text({ parcelRoles: ['TRAVELER'] })).toContain('pour le voyageur')
    expect(text({ parcelRoles: [] })).not.toContain('pour l’expéditeur')
    expect(text({ parcelRoles: [] })).toContain('quel que soit son rôle')
  })

  it('sans étape du colis, les rôles ne sont pas mentionnés', () => {
    expect(text({ triggers: ['SEARCH_TAB'], frequency: 'ONCE', parcelRoles: ['SENDER'] })).not.toContain('expéditeur')
  })

  it('étapes et fréquence en clair', () => {
    const t = text({ triggers: ['PARCEL_ACCEPTED', 'PARCEL_DELIVERED'] })
    expect(t).toContain('colis accepté')
    expect(t).toContain('colis livré')
    expect(t).toContain('une fois par colis')
  })

  it('un déclencheur inconnu ne plante pas', () => {
    expect(() => text({ triggers: ['PARCEL_LOST' as never] })).not.toThrow()
  })
})
