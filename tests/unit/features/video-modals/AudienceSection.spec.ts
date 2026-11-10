import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import AudienceSection from '@/features/video-modals/components/AudienceSection.vue'
import { useAudienceRule } from '@/features/broadcast/composables/useAudienceRule'
import type { ModalPlatform } from '@/features/video-modals/types/index'
import { audienceFields, ciRule } from './fixtures'

function mountSection(over: Record<string, unknown> = {}, errors: Record<string, string> = {}) {
  const rule = useAudienceRule(audienceFields)
  const state = reactive({ connectedOnly: false, minAppVersion: '', maxAppVersion: '', platforms: [] as ModalPlatform[], samplePercent: 100 as number | string })
  const w = mount(AudienceSection, {
    props: {
      fields: audienceFields, rule, catalogLoading: false, catalogError: null, visitorsExcluded: false, errors,
      connectedOnly: state.connectedOnly, 'onUpdate:connectedOnly': (v: boolean) => { state.connectedOnly = v },
      minAppVersion: state.minAppVersion, 'onUpdate:minAppVersion': (v: string) => { state.minAppVersion = v },
      maxAppVersion: state.maxAppVersion, 'onUpdate:maxAppVersion': (v: string) => { state.maxAppVersion = v },
      platforms: state.platforms, 'onUpdate:platforms': (v: ModalPlatform[]) => { state.platforms = v },
      samplePercent: state.samplePercent, 'onUpdate:samplePercent': (v: number | string) => { state.samplePercent = v },
      ...over,
    },
  })
  return { w, rule, state }
}

describe('AudienceSection : conditions de Communications', () => {
  it('réutilise le constructeur de règles de la Diffusion (ET / OU, ajout d’une condition par famille de champs)', async () => {
    const { w, rule } = mountSection()
    expect(w.find('[data-test="rule-group"]').exists()).toBe(true)
    expect(w.find('[data-test="group-op"]').exists()).toBe(true)
    await w.get('[data-test="add-condition"]').trigger('click')
    expect(w.get('[data-test="field-picker"]').text()).toContain('Pays de résidence')
    await w.get('[data-test="pick-field-country"]').trigger('click')
    expect(rule.conditionCount.value).toBe(1)
    expect(w.findAll('[data-test="condition-row"]')).toHaveLength(1)
  })

  it('une condition existante (chargée depuis la campagne) est affichée', () => {
    const rule = useAudienceRule(audienceFields)
    rule.load(ciRule())
    const w = mountSection({ rule }).w
    expect(w.findAll('[data-test="condition-row"]')).toHaveLength(2)
  })

  it('chargement du catalogue : message, pas de constructeur', () => {
    const w = mountSection({ catalogLoading: true }).w
    expect(w.get('[data-test="vm-catalog-loading"]').text()).toContain('Chargement')
    expect(w.find('[data-test="rule-group"]').exists()).toBe(false)
  })

  it('catalogue indisponible : erreur et « Réessayer »', async () => {
    const w = mountSection({ fields: [], catalogError: 'Impossible de charger les critères de ciblage' }).w
    expect(w.get('[data-test="vm-catalog-error"]').text()).toContain('Impossible de charger')
    expect(w.find('[data-test="rule-group"]').exists()).toBe(false)
    await w.get('[data-test="vm-catalog-retry"]').trigger('click')
    expect(w.emitted('reload-catalog')).toHaveLength(1)
  })

  it('erreur de conditions affichée', () => {
    expect(mountSection({}, { conditions: 'Complétez ou retirez les conditions incomplètes.' }).w.get('[data-test="vm-conditions-error"]').text()).toContain('incomplètes')
  })
})

describe('AudienceSection : réglages propres aux modals', () => {
  it('version minimale et maximale', async () => {
    const { w, state } = mountSection()
    await w.get('[data-test="vm-min-version"]').setValue('1.0.6')
    await w.get('[data-test="vm-max-version"]').setValue('1.2.0')
    expect(state.minAppVersion).toBe('1.0.6')
    expect(state.maxAppVersion).toBe('1.2.0')
  })

  it('système : Android et iPhone, aucun coché = tous', async () => {
    const { w, state } = mountSection()
    expect(w.text()).toContain('Aucun coché : tous les systèmes')
    await w.get('[data-test="vm-platform-ANDROID"] input').trigger('change')
    expect(state.platforms).toEqual(['ANDROID'])
    await w.setProps({ platforms: ['ANDROID'] })
    await w.get('[data-test="vm-platform-IOS"] input').trigger('change')
    expect(state.platforms).toEqual(['ANDROID', 'IOS'])
    await w.setProps({ platforms: ['ANDROID', 'IOS'] })
    expect(w.get('[data-test="vm-platform-IOS"]').text()).toBe('iPhone')
    await w.get('[data-test="vm-platform-ANDROID"] input').trigger('change')
    expect(state.platforms).toEqual(['IOS'])
  })

  it('tirage au sort en pourcentage ; champ vidé = vide (refusé à l’enregistrement)', async () => {
    const { w, state } = mountSection()
    const input = w.get('[data-test="vm-sample"]')
    expect(input.attributes('min')).toBe('1')
    expect(input.attributes('max')).toBe('100')
    await input.setValue('50')
    expect(state.samplePercent).toBe(50)
    await input.setValue('')
    expect(state.samplePercent).toBe('')
  })

  it('« Seulement les personnes connectées »', async () => {
    const { w, state } = mountSection()
    await w.get('[data-test="vm-connected-only"]').trigger('click')
    expect(state.connectedOnly).toBe(true)
    expect(w.get('[data-test="vm-connected-only"]').attributes('aria-label')).toBe('Seulement les personnes connectées')
  })

  it('visiteurs : note selon que le ciblage les exclut ou non', async () => {
    const { w } = mountSection()
    expect(w.get('[data-test="vm-visitors-note"]').text()).toContain('reste visible aux visiteurs sans compte')
    await w.setProps({ visitorsExcluded: true })
    expect(w.get('[data-test="vm-visitors-note"]').text()).toContain('ne verront pas ce modal')
  })

  it('erreurs de version, de système et de tirage affichées', () => {
    const { w } = mountSection({}, { minAppVersion: 'Version au format 1.2.3.', maxAppVersion: 'Max < min', platforms: 'Système inconnu.', samplePercent: 'Pourcentage entier' })
    expect(w.get('[data-test="vm-min-version-error"]').text()).toContain('1.2.3')
    expect(w.get('[data-test="vm-max-version-error"]').text()).toContain('Max < min')
    expect(w.text()).toContain('Système inconnu.')
    expect(w.get('[data-test="vm-sample-error"]').text()).toContain('Pourcentage entier')
  })
})
