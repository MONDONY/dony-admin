import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ParcelRolesSection from '@/features/video-modals/components/ParcelRolesSection.vue'
import ActionEditor from '@/features/video-modals/components/ActionEditor.vue'
import InfoModalPreview from '@/features/video-modals/components/InfoModalPreview.vue'
import { PARCEL_SCREENS, type ParcelRole } from '@/features/video-modals/types/index'

describe('ParcelRolesSection', () => {
  it('ParcelRolesSection_visibleOnlyWithParcelTrigger', () => {
    const hidden = mount(ParcelRolesSection, { props: { modelValue: [], visible: false } })
    expect(hidden.find('[data-test="vm-parcel-roles"]').exists()).toBe(false)
    const shown = mount(ParcelRolesSection, { props: { modelValue: [], visible: true } })
    expect(shown.get('[data-test="vm-parcel-roles"]').text()).toContain('Aucun choix : visible par tous les rôles')
    expect(['SENDER', 'TRAVELER', 'RECIPIENT'].map(r => shown.get(`[data-test="vm-parcel-role-${r}"]`).text())).toEqual(['Expéditeur', 'Voyageur', 'Destinataire'])
  })

  it('cocher émet la liste, décocher la retire, l’aide disparaît dès qu’un rôle est choisi', async () => {
    const w = mount(ParcelRolesSection, { props: { modelValue: ['SENDER'] as ParcelRole[], visible: true } })
    expect(w.text()).not.toContain('Aucun choix')
    await w.get('[data-test="vm-parcel-role-TRAVELER"] input').setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([['SENDER', 'TRAVELER']])
    await w.get('[data-test="vm-parcel-role-SENDER"] input').setValue(false)
    expect(w.emitted('update:modelValue')![1]).toEqual([[]])
  })

  it('erreur affichée', () => {
    const w = mount(ParcelRolesSection, { props: { modelValue: [], visible: true, error: 'Rôle inconnu' } })
    expect(w.get('[data-test="vm-parcel-roles-error"]').text()).toBe('Rôle inconnu')
  })
})

describe('ParcelRolesSection : avertissement et rôle inconnu', () => {
  it('I1 : avertissement avec les noms des autres déclencheurs', () => {
    const w = mount(ParcelRolesSection, { props: { modelValue: [], visible: true, otherTriggers: ['SEARCH_TAB', 'APP_OPEN'] } })
    const t = w.get('[data-test="vm-parcel-mixed-warning"]').text()
    expect(t).toContain('Ce modal s’ouvre aussi hors d’un colis (')
    expect(t).toContain('le rôle n’y est pas vérifié, les variables y restent entre accolades et les boutons du colis y ferment le modal.')
    expect(mount(ParcelRolesSection, { props: { modelValue: [], visible: true } }).find('[data-test="vm-parcel-mixed-warning"]').exists()).toBe(false)
  })

  it('M1 : un rôle inconnu est affiché brut, coché, et conservé', async () => {
    const w = mount(ParcelRolesSection, { props: { modelValue: ['COURIER'] as never, visible: true } })
    expect(w.get('[data-test="vm-parcel-role-COURIER"]').text()).toBe('COURIER')
    expect((w.get('[data-test="vm-parcel-role-COURIER"] input').element as HTMLInputElement).checked).toBe(true)
    await w.get('[data-test="vm-parcel-role-SENDER"] input').setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([['SENDER', 'COURIER']])
  })
})

describe('ActionEditor : boutons du colis', () => {
  const mountEditor = (parcelSteps?: boolean, screen = 'SEARCH') => mount(ActionEditor, {
    props: { prefix: 'primary', title: 'Bouton principal', action: { kind: 'SCREEN', screen, url: null } as never, labelFr: 'Voir', labelEn: 'See', errors: {}, parcelSteps },
  })
  const values = (w: ReturnType<typeof mountEditor>) => w.findAll('[data-test="vm-primary-screen"] option').map(o => o.attributes('value')).filter(Boolean)

  it('ActionEditor_offersParcelButtonsOnlyWithParcelTrigger', () => {
    for (const s of PARCEL_SCREENS) expect(values(mountEditor(false))).not.toContain(s)
    for (const s of PARCEL_SCREENS) expect(values(mountEditor(true))).toContain(s)
  })

  it('un bouton du colis déjà choisi reste visible même sans étape (l’erreur de validation l’explique)', () => {
    expect(values(mountEditor(false, 'PARCEL_QR'))).toContain('PARCEL_QR')
  })
})

describe('InfoModalPreview : exemples par rôle', () => {
  const base = {
    lang: 'fr' as const, icon: 'BELL' as const,
    titleFr: 'Ne remettez rien sans le code', titleEn: '', subtitleFr: '', subtitleEn: '',
    bodyFr: '{expéditeur} envoie à {destinataire} par {voyageur} vers {ville_arrivee}', bodyEn: '',
    primaryLabelFr: '', primaryLabelEn: '', primaryKind: 'SCREEN' as const, primaryScreen: 'PARCEL_QR' as const,
    secondaryEnabled: false, secondaryLabelFr: '', secondaryLabelEn: '', secondaryKind: 'CLOSE' as const,
  }

  it('Preview_replacesVariablesWithExamplesPerRole', async () => {
    const w = mount(InfoModalPreview, { props: { ...base, parcelSteps: true } })
    expect(w.get('[data-test="vm-preview-body"]').text()).toBe('Mamadou envoie à Fatou par Awa vers Abidjan')
    for (const r of ['SENDER', 'TRAVELER', 'RECIPIENT']) {
      await w.get(`[data-test="vm-preview-role-${r}"]`).trigger('click')
      expect(w.get(`[data-test="vm-preview-role-${r}"]`).attributes('aria-pressed')).toBe('true')
      expect(w.get('[data-test="vm-preview-body"]').text()).toContain('Abidjan')
    }
  })

  it('le sélecteur de rôle n’apparaît qu’avec une étape du colis ; sans étape, les variables restent en clair (I1)', () => {
    const w = mount(InfoModalPreview, { props: { ...base, parcelSteps: false } })
    expect(w.find('[data-test="vm-preview-role-SENDER"]').exists()).toBe(false)
    expect(w.get('[data-test="vm-preview-body"]').text()).toContain('{expéditeur}')
  })

  it('I2 : seuls les rôles visés sont proposés, le premier par défaut', () => {
    const w = mount(InfoModalPreview, { props: { ...base, parcelSteps: true, parcelRoles: ['TRAVELER', 'RECIPIENT'] } })
    expect(w.find('[data-test="vm-preview-role-SENDER"]').exists()).toBe(false)
    expect(w.get('[data-test="vm-preview-role-TRAVELER"]').attributes('aria-pressed')).toBe('true')
    expect(w.text()).toContain('Aperçu pour :')
  })

  it('I2 : QR masqué hors expéditeur, le secondaire remonte ; les deux masqués : « OK » seul', async () => {
    const w = mount(InfoModalPreview, { props: { ...base, parcelSteps: true, secondaryEnabled: true, secondaryLabelFr: 'Suivre', secondaryKind: 'SCREEN', secondaryScreen: 'PARCEL_TRACKING' } })
    expect(w.get('[data-test="vm-preview-primary"]').text()).toBe('Afficher le QR du colis')
    await w.get('[data-test="vm-preview-role-TRAVELER"]').trigger('click')
    expect(w.get('[data-test="vm-preview-primary"]').text()).toBe('Suivre')
    expect(w.find('[data-test="vm-preview-secondary"]').exists()).toBe(false)
    const both = mount(InfoModalPreview, { props: { ...base, parcelSteps: true, parcelRoles: ['RECIPIENT'], secondaryEnabled: false } })
    expect(both.get('[data-test="vm-preview-primary"]').text()).toBe('OK')
  })

  it('I2 : « Envoyer le code » absent à PARCEL_ACCEPTED, avertissements sans blocage', () => {
    const w = mount(InfoModalPreview, { props: { ...base, parcelSteps: true, primaryScreen: 'PARCEL_SEND_CODE', triggers: ['PARCEL_ACCEPTED'] } })
    expect(w.get('[data-test="vm-preview-primary"]').text()).toBe('OK')
    expect(w.get('[data-test="vm-preview-warn-code"]').exists()).toBe(true)
    const ok = mount(InfoModalPreview, { props: { ...base, parcelSteps: true, primaryScreen: 'PARCEL_SEND_CODE', triggers: ['PARCEL_HANDED_OVER'] } })
    expect(ok.get('[data-test="vm-preview-primary"]').text()).toBe('Envoyer le code de retrait')
    expect(ok.find('[data-test="vm-preview-warn-code"]').exists()).toBe(false)
  })

  it('bouton du colis sans libellé : même libellé que la liste admin', () => {
    const w = mount(InfoModalPreview, { props: { ...base, parcelSteps: true } })
    expect(w.get('[data-test="vm-preview-primary"]').text()).toBe('Afficher le QR du colis')
  })

  it('titre et sous-titre reçoivent aussi les exemples', () => {
    const w = mount(InfoModalPreview, { props: { ...base, titleFr: '{voyageur} est arrivé à {ville_arrivee}', subtitleFr: 'Pour {destinataire}', parcelSteps: true } })
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Awa est arrivé à Abidjan')
    expect(w.get('[data-test="vm-preview-subtitle"]').text()).toBe('Pour Fatou')
  })
})
