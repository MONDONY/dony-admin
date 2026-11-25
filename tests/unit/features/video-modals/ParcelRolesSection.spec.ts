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

  it('le sélecteur de rôle n’apparaît qu’avec une étape du colis, les variables sont remplacées quand même', () => {
    const w = mount(InfoModalPreview, { props: { ...base, parcelSteps: false } })
    expect(w.find('[data-test="vm-preview-role-SENDER"]').exists()).toBe(false)
    expect(w.get('[data-test="vm-preview-body"]').text()).toContain('Mamadou')
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
