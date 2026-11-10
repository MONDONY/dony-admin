import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TriggerPicker from '@/features/video-modals/components/TriggerPicker.vue'
import { COMING_SOON_MOMENTS, SITUATION_KINDS, VIDEO_MODAL_TRIGGERS } from '@/features/video-modals/types/index'

const mountPicker = (props: Record<string, unknown> = {}) =>
  mount(TriggerPicker, { props: { triggers: ['SEARCH_TAB'], situations: [], isInfo: false, ...props } })

const sit = (w: ReturnType<typeof mountPicker>, sel: string) => w.get(sel).text().replace(/\s+/g, ' ').trim()

describe('TriggerPicker : moments', () => {
  it('les huit déclencheurs existants, libellés de la maquette, SEARCH_TAB coché', () => {
    const w = mountPicker()
    for (const t of VIDEO_MODAL_TRIGGERS) expect(w.find(`[data-test="vm-trigger-${t}"]`).exists(), t).toBe(true)
    expect(w.get('[data-test="vm-trigger-APP_OPEN"]').text()).toBe('Ouverture de l’app')
    expect(w.get('[data-test="vm-trigger-PUBLISH_TRIP"]').text()).toBe('Bouton Publier un trajet')
    expect((w.get('[data-test="vm-trigger-SEARCH_TAB"] input').element as HTMLInputElement).checked).toBe(true)
    expect((w.get('[data-test="vm-trigger-TRACKING_TAB"] input').element as HTMLInputElement).checked).toBe(false)
  })

  it('cocher ou décocher émet le déclencheur', async () => {
    const w = mountPicker()
    await w.get('[data-test="vm-trigger-TRACKING_TAB"] input').trigger('change')
    expect(w.emitted('toggle-trigger')![0]).toEqual(['TRACKING_TAB'])
  })

  it('moments de l’étape 2 : grisés, « Bientôt », sans case à cocher, jamais émis', async () => {
    const w = mountPicker()
    const all = [...COMING_SOON_MOMENTS.ACTION, ...COMING_SOON_MOMENTS.SEARCH, ...COMING_SOON_MOMENTS.PAYMENT, ...COMING_SOON_MOMENTS.ACCOUNT]
    expect(all.length).toBe(13)
    for (const label of all) {
      const chip = w.findAll('[aria-disabled="true"]').find(c => c.text().startsWith(label))
      expect(chip, label).toBeDefined()
      expect(chip!.text()).toContain('Bientôt')
      expect(chip!.find('input').exists(), label).toBe(false)
      await chip!.trigger('click')
    }
    expect(w.emitted('toggle-trigger')).toBeUndefined()
    expect(w.emitted('toggle-situation')).toBeUndefined()
  })

  it('délai d’ouverture en lecture seule : 2 secondes', () => {
    const w = mountPicker()
    expect(w.get('[data-test="vm-delay"]').text()).toBe('2 secondes après le déclencheur')
    expect(w.find('[data-test="vm-delay"] input').exists()).toBe(false)
    expect(w.text()).not.toContain('sans délai')
  })

  it('un bouton Publier ou Envoyer coché : précise l’absence de délai', () => {
    expect(mountPicker({ triggers: ['PUBLISH_TRIP'] }).text()).toContain('sans délai, avant le formulaire')
    expect(mountPicker({ triggers: ['SEND_PARCEL'] }).text()).toContain('sans délai, avant le formulaire')
  })

  it('notes différentes pour une vidéo et une information, plafond d’un modal par jour', () => {
    const video = mountPicker()
    expect(video.text()).toContain('« Commencer » ou la fin de la vidéo')
    expect(video.text()).toContain('au plus un par jour et par personne')
    const info = mountPicker({ isInfo: true })
    expect(info.text()).toContain('sans rejouer un modal')
    expect(info.text()).toContain('au plus un par jour et par personne')
  })

  it('erreur de déclencheur affichée', () => {
    expect(mountPicker({ error: 'Choisissez au moins un endroit' }).get('[data-test="vm-triggers-error"]').text()).toContain('au moins un endroit')
  })
})

describe('TriggerPicker : situations', () => {
  it('les huit situations, avec la valeur proposée tant qu’elles sont décochées', () => {
    const w = mountPicker()
    for (const k of SITUATION_KINDS) expect(w.find(`[data-test="vm-situation-${k}"]`).exists(), k).toBe(true)
    expect(sit(w, '[data-test="vm-situation-OFFER_ACCEPTED_UNPAID"]')).toBe('Offre acceptée, non payée depuis 6 h')
    expect(sit(w, '[data-test="vm-situation-OFFER_UNANSWERED"]')).toBe('Offre reçue sans réponse depuis 12 h')
    expect(sit(w, '[data-test="vm-situation-COUNTER_OFFER_PENDING"]')).toBe('Contre-offre en attente depuis 24 h')
    expect(sit(w, '[data-test="vm-situation-RETURN_AFTER_ABSENCE"]')).toBe('Retour après 14 jours d’absence')
    expect(sit(w, '[data-test="vm-situation-DAYS_SINCE_INSTALL_NO_ACTION"]')).toBe('3 jours après l’installation, sans action')
    expect(sit(w, '[data-test="vm-situation-KYC_ABANDONED"]')).toBe('Identité commencée puis abandonnée')
    expect(sit(w, '[data-test="vm-situation-PROFILE_INCOMPLETE"]')).toBe('Profil incomplet')
    expect(sit(w, '[data-test="vm-situation-FIRST_DELIVERY_NO_REFERRAL"]')).toBe('1re livraison réussie sans parrainage')
    expect(w.find('[data-test^="vm-situation-value-"]').exists()).toBe(false)
    expect(w.find('[data-test="vm-situations-note"]').exists()).toBe(false)
  })

  it('cocher une situation émet son type', async () => {
    const w = mountPicker()
    await w.get('[data-test="vm-situation-KYC_ABANDONED"] input').trigger('change')
    expect(w.emitted('toggle-situation')![0]).toEqual(['KYC_ABANDONED'])
  })

  it('cochée : la valeur devient un champ orange, modifiable ; heures ou jours', async () => {
    const w = mountPicker({ situations: [{ kind: 'OFFER_ACCEPTED_UNPAID', value: 6 }, { kind: 'RETURN_AFTER_ABSENCE', value: 14 }, { kind: 'PROFILE_INCOMPLETE', value: null }] })
    const hours = w.get('[data-test="vm-situation-value-OFFER_ACCEPTED_UNPAID"]')
    expect((hours.element as HTMLInputElement).value).toBe('6')
    expect(hours.attributes('aria-label')).toBe('Valeur en heures')
    expect(hours.attributes('max')).toBe('720')
    expect(hours.classes()).toContain('text-accent')
    expect(w.get('[data-test="vm-situation-value-RETURN_AFTER_ABSENCE"]').attributes('aria-label')).toBe('Valeur en jours')
    expect(w.get('[data-test="vm-situation-value-RETURN_AFTER_ABSENCE"]').attributes('max')).toBe('365')
    // Une situation sans valeur n'a pas de champ.
    expect(w.find('[data-test="vm-situation-value-PROFILE_INCOMPLETE"]').exists()).toBe(false)
    expect(w.get('[data-test="vm-situation-OFFER_ACCEPTED_UNPAID"]').classes()).toContain('border-accent')
    await hours.setValue('9')
    expect(w.emitted('set-situation-value')![0]).toEqual(['OFFER_ACCEPTED_UNPAID', '9'])
    expect(w.get('[data-test="vm-situation-DAYS_SINCE_INSTALL_NO_ACTION"]').classes()).not.toContain('border-accent')
  })

  it('valeur vide saisie : champ vide affiché', () => {
    const w = mountPicker({ situations: [{ kind: 'OFFER_UNANSWERED', value: '' }] })
    expect((w.get('[data-test="vm-situation-value-OFFER_UNANSWERED"]').element as HTMLInputElement).value).toBe('')
  })

  it('note sur les visiteurs et l’ouverture de l’app, erreur de situation', () => {
    const w = mountPicker({ situations: [{ kind: 'KYC_ABANDONED', value: null }], situationsError: 'Valeur hors bornes' })
    expect(w.get('[data-test="vm-situations-note"]').text()).toContain('jamais montré aux visiteurs sans compte')
    expect(w.get('[data-test="vm-situations-note"]').text()).toContain('à l’ouverture de l’app')
    expect(w.get('[data-test="vm-situations-error"]').text()).toBe('Valeur hors bornes')
  })
})
