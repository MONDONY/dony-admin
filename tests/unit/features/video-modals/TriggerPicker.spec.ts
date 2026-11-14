import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TriggerPicker from '@/features/video-modals/components/TriggerPicker.vue'
import { MOMENT_GROUPS, MOMENT_TRIGGERS, SCREEN_TRIGGERS, SITUATION_KINDS } from '@/features/video-modals/types/index'

const mountPicker = (props: Record<string, unknown> = {}) =>
  mount(TriggerPicker, { props: { triggers: ['SEARCH_TAB'], situations: [], isInfo: false, ...props } })

const sit = (w: ReturnType<typeof mountPicker>, sel: string) => w.get(sel).text().replace(/\s+/g, ' ').trim()

describe('TriggerPicker : moments', () => {
  it('les huit déclencheurs existants, libellés de la maquette, SEARCH_TAB coché', () => {
    const w = mountPicker()
    for (const t of SCREEN_TRIGGERS) expect(w.find(`[data-test="vm-trigger-${t}"]`).exists(), t).toBe(true)
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

  it('moments de l’étape 2 : les treize sont des pastilles cochables, plus aucun « Bientôt »', async () => {
    const w = mountPicker()
    expect(MOMENT_TRIGGERS).toHaveLength(13)
    expect(w.text()).not.toContain('Bientôt')
    expect(w.find('[aria-disabled="true"]').exists()).toBe(false)
    for (const t of MOMENT_TRIGGERS) {
      const chip = w.get(`[data-test="vm-trigger-${t}"]`)
      expect(chip.find('input[type="checkbox"]').exists(), t).toBe(true)
      await chip.get('input').trigger('change')
      expect(w.emitted('toggle-trigger')!.at(-1), t).toEqual([t])
    }
  })

  it('moments : libellés de la maquette, rangés par famille', () => {
    const w = mountPicker()
    expect(w.get('[data-test="vm-trigger-DELIVERY_CONFIRMED"]').text()).toBe('Livraison confirmée')
    expect(w.get('[data-test="vm-trigger-SEARCH_NO_TRIP_RESULTS"]').text()).toBe('Recherche de trajet sans résultat')
    expect(w.get('[data-test="vm-trigger-TRIP_VIEWED_REPEATEDLY"]').text()).toBe('Même trajet consulté plusieurs fois')
    expect(w.get('[data-test="vm-trigger-PAYMENT_FAILED"]').text()).toBe('Paiement échoué ou annulé')
    expect(w.get('[data-test="vm-trigger-APP_UPDATED"]').text()).toBe('Première ouverture après une mise à jour')
    const inside = (family: string) => w.get(`[data-test="vm-moments-${family}"]`)
    for (const t of MOMENT_GROUPS.ACTION) expect(inside('action').find(`[data-test="vm-trigger-${t}"]`).exists(), t).toBe(true)
    for (const t of MOMENT_GROUPS.SEARCH) expect(inside('search').find(`[data-test="vm-trigger-${t}"]`).exists(), t).toBe(true)
    for (const t of [...MOMENT_GROUPS.ACTION, ...MOMENT_GROUPS.SEARCH, ...MOMENT_GROUPS.PAYMENT, ...MOMENT_GROUPS.ACCOUNT]) {
      expect(w.findAll(`[data-test="vm-trigger-${t}"]`), t).toHaveLength(1)
    }
  })

  it('moment coché : pastille bleue, case cochée', () => {
    const w = mountPicker({ triggers: ['PAYMENT_SUCCEEDED'] })
    expect((w.get('[data-test="vm-trigger-PAYMENT_SUCCEEDED"] input').element as HTMLInputElement).checked).toBe(true)
    expect(w.get('[data-test="vm-trigger-PAYMENT_SUCCEEDED"]').classes()).toContain('border-primary')
    expect(w.get('[data-test="vm-trigger-KYC_VERIFIED"]').classes()).not.toContain('border-primary')
  })

  it('seuils : visibles seulement quand le moment correspondant est coché', () => {
    const none = mountPicker()
    expect(none.find('[data-test="vm-opt-few-results"]').exists()).toBe(false)
    expect(none.find('[data-test="vm-opt-trip-viewed"]').exists()).toBe(false)
    const few = mountPicker({ triggers: ['SEARCH_FEW_RESULTS'] })
    expect(few.find('[data-test="vm-opt-few-results"]').exists()).toBe(true)
    expect(few.find('[data-test="vm-opt-trip-viewed"]').exists()).toBe(false)
    const viewed = mountPicker({ triggers: ['TRIP_VIEWED_REPEATEDLY'] })
    expect(viewed.find('[data-test="vm-opt-few-results"]').exists()).toBe(false)
    expect(viewed.find('[data-test="vm-opt-trip-viewed"]').exists()).toBe(true)
  })

  it('seuils : défauts 2 et 3, bornes 1..20 et 2..10, la saisie est émise', async () => {
    const w = mountPicker({ triggers: ['SEARCH_FEW_RESULTS', 'TRIP_VIEWED_REPEATEDLY'] })
    const few = w.get('[data-test="vm-few-results-max"]')
    const viewed = w.get('[data-test="vm-trip-viewed-times"]')
    expect((few.element as HTMLInputElement).value).toBe('2')
    expect((viewed.element as HTMLInputElement).value).toBe('3')
    expect([few.attributes('min'), few.attributes('max')]).toEqual(['1', '20'])
    expect([viewed.attributes('min'), viewed.attributes('max')]).toEqual(['2', '10'])
    await few.setValue('5')
    await viewed.setValue('7')
    expect(w.emitted('set-trigger-option')).toEqual([['fewResultsMax', '5'], ['tripViewedTimes', '7']])
  })

  it('seuils : valeurs saisies reprises, erreurs affichées seulement avec le moment coché', () => {
    const w = mountPicker({
      triggers: ['SEARCH_FEW_RESULTS', 'TRIP_VIEWED_REPEATEDLY'], triggerOptions: { fewResultsMax: 9, tripViewedTimes: '' },
      fewResultsError: 'Nombre entier, de 1 à 20.', tripViewedError: 'Nombre entier, de 2 à 10.',
    })
    expect((w.get('[data-test="vm-few-results-max"]').element as HTMLInputElement).value).toBe('9')
    expect((w.get('[data-test="vm-trip-viewed-times"]').element as HTMLInputElement).value).toBe('')
    expect(w.get('[data-test="vm-few-results-error"]').text()).toContain('1 à 20')
    expect(w.get('[data-test="vm-trip-viewed-error"]').text()).toContain('2 à 10')
    const hidden = mountPicker({ fewResultsError: 'x', tripViewedError: 'y' })
    expect(hidden.find('[data-test="vm-few-results-error"]').exists()).toBe(false)
    expect(hidden.find('[data-test="vm-trip-viewed-error"]').exists()).toBe(false)
  })

  it('mention des anciennes versions : seulement quand un moment de l’étape 2 est coché', () => {
    expect(mountPicker({ triggers: ['SEARCH_TAB', 'APP_OPEN', 'PUBLISH_TRIP'] }).find('[data-test="vm-moments-compat-note"]').exists()).toBe(false)
    expect(mountPicker({ triggers: [] }).find('[data-test="vm-moments-compat-note"]').exists()).toBe(false)
    const w = mountPicker({ triggers: ['SEARCH_TAB', 'KYC_VERIFIED'] })
    expect(w.get('[data-test="vm-moments-compat-note"]').text()).toContain('Les anciennes versions de l’app ne verront que les moments d’écran et de bouton')
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

  it('notes différentes pour une vidéo et une information', () => {
    const video = mountPicker()
    expect(video.text()).toContain('« Commencer » ou la fin de la vidéo')
    expect(video.text()).toContain('jamais deux en même temps')
    const info = mountPicker({ isInfo: true })
    expect(info.text()).toContain('sans rejouer un modal')
    expect(info.text()).toContain('jamais deux en même temps')
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
