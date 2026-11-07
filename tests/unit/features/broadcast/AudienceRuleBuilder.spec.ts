import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AudienceRuleBuilder from '@/features/broadcast/components/AudienceRuleBuilder.vue'
import { useAudienceRule } from '@/features/broadcast/composables/useAudienceRule'
import type { AudienceField } from '@/features/broadcast/types/index'

const fields: AudienceField[] = [
  { key: 'bids_count', family: 'ACTIVITY', label: 'Demandes créées', operators: [{ key: 'GTE', label: 'au moins', valueType: 'INT' }, { key: 'WITHIN_DAYS', label: 'dans les derniers jours', valueType: 'INT' }, { key: 'EVER', label: 'au moins une fois', valueType: 'NONE' }], values: [] },
  { key: 'is_pro', family: 'STATUS', label: 'Compte Pro', operators: [{ key: 'IS', label: 'est', valueType: 'BOOLEAN' }], values: [] },
  { key: 'corridor_interest', family: 'GEO', label: 'Corridor', operators: [{ key: 'MATCHES', label: 'correspond à', valueType: 'CORRIDOR' }], values: [] },
  { key: 'country', family: 'GEO', label: 'Pays', operators: [{ key: 'IN', label: 'parmi', valueType: 'ENUM_MULTI' }], values: [{ key: 'FR', label: 'France' }, { key: 'SN', label: 'Sénégal' }] },
  { key: 'wallet', family: 'MONEY', label: 'Solde', operators: [{ key: 'GTE', label: 'au moins', valueType: 'INT' }], values: [] },
]

function build() {
  const rule = useAudienceRule(fields)
  const w = mount(AudienceRuleBuilder, { props: { fields, rule } })
  return { rule, w }
}

describe('AudienceRuleBuilder', () => {
  it('ajouterCondition_afficheLesFamilles', async () => {
    const { w } = build()
    await w.find('[data-test="add-condition"]').trigger('click')
    const text = w.text()
    for (const f of ['Statut du compte', 'Activité', 'Géographie', 'Argent']) expect(text).toContain(f)
    await w.find('[data-test="pick-field-is_pro"]').trigger('click')
    expect(w.findAll('[data-test="condition-row"]')).toHaveLength(1)
  })

  it('basculerOU_metAJourLeGroupe', async () => {
    const { w, rule } = build()
    await w.find('[data-test="group-op"]').setValue('OR')
    expect(rule.root.value.op).toBe('OR')
  })

  it('profondeur3_masqueAjouterGroupe', async () => {
    const { w } = build()
    const groups = () => w.findAll('[data-test="rule-group"]')
    expect(groups()).toHaveLength(1)
    await w.find('[data-test="add-group"]').trigger('click')
    expect(groups()).toHaveLength(2)
    await groups()[1]!.find('[data-test="add-group"]').trigger('click')
    expect(groups()).toHaveLength(3)
    // le groupe de profondeur 3 n'a pas de bouton « Ajouter un groupe »
    expect(groups()[2]!.find('[data-test="add-group"]').exists()).toBe(false)
    expect(groups()[1]!.find('[data-test="add-group"]').exists()).toBe(true)
  })

  it('valueTypeInt_afficheChampNumerique', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'bids_count')!
    await w.vm.$nextTick()
    const input = w.find('input[type="number"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('min')).toBe('0')
    expect(input.attributes('max')).toBe('10000')
    await input.setValue('5')
    expect((rule.root.value.children.find((c) => c.id === id) as any).value).toBe(5)
  })

  it('corridor_exigeUneBorne', async () => {
    const { w, rule } = build()
    rule.addCondition(rule.root.value.id, 'corridor_interest')
    await w.vm.$nextTick()
    expect(w.text()).toContain('Indiquez un départ ou une arrivée')
    await w.find('[data-test="corridor-origin"]').setValue('Paris')
    expect(w.text()).not.toContain('Indiquez un départ ou une arrivée')
  })

  it('limite30_desactiveLesBoutons', async () => {
    const { w, rule } = build()
    for (let i = 0; i < 30; i++) rule.addCondition(rule.root.value.id, 'is_pro')
    await w.vm.$nextTick()
    expect(w.text()).toContain('30 conditions au maximum')
    expect((w.find('[data-test="add-condition"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('[data-test="add-group"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('supprimer_retireLaCondition', async () => {
    const { w, rule } = build()
    rule.addCondition(rule.root.value.id, 'is_pro')
    await w.vm.$nextTick()
    await w.find('[data-test="remove-condition"]').trigger('click')
    expect(rule.root.value.children).toHaveLength(0)
  })

  it('enumMulti_coche', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'country')!
    await w.vm.$nextTick()
    await w.findAll('input[type="checkbox"]')[1]!.setValue(true)
    expect((rule.root.value.children.find((c) => c.id === id) as any).value).toEqual(['SN'])
  })

  it('booleen_choixOuiNon', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'is_pro')!
    await w.vm.$nextTick()
    await w.find('[data-test="value-boolean"]').setValue('true')
    expect((rule.root.value.children.find((c) => c.id === id) as any).value).toBe(true)
  })

  it('valueTypeInt_operateurJours_plafond3650', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'bids_count')!
    rule.update(id, { operator: 'WITHIN_DAYS' })
    await w.vm.$nextTick()
    expect(w.find('input[type="number"]').attributes('max')).toBe('3650')
    await w.find('input[type="number"]').setValue('4000')
    expect(w.find('[data-test="int-error"]').text()).toBe('Nombre entier de 0 à 3\u202f650')
  })

  it('int_hors_bornes_afficheMessage', async () => {
    const { w, rule } = build()
    rule.addCondition(rule.root.value.id, 'bids_count')
    await w.vm.$nextTick()
    expect(w.find('[data-test="int-error"]').exists()).toBe(false)
    await w.find('input[type="number"]').setValue('10001')
    expect(w.find('[data-test="int-error"]').text()).toContain('de 0 à 10')
    await w.find('input[type="number"]').setValue('12')
    expect(w.find('[data-test="int-error"]').exists()).toBe(false)
  })

  it('changerOperateur_reinitialiseLaValeur', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'bids_count')!
    await w.vm.$nextTick()
    await w.find('input[type="number"]').setValue('5')
    await w.find('[data-test="condition-operator"]').setValue('WITHIN_DAYS')
    expect((rule.root.value.children.find((c) => c.id === id) as any).value).toBeNull()
  })

  it('corridor_basculeVillePays_effaceLesBornes', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'corridor_interest')!
    await w.vm.$nextTick()
    await w.find('[data-test="corridor-origin"]').setValue('Paris')
    await w.find('[data-test="corridor-kind"]').setValue('COUNTRY')
    const v = (rule.root.value.children.find((c) => c.id === id) as any).value
    expect(v.kind).toBe('COUNTRY')
    expect(v.origin).toBe('')
    expect(v.destination).toBe('')
  })

  it('corridor_sources_cochees', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'corridor_interest')!
    await w.vm.$nextTick()
    const get = () => (rule.root.value.children.find((c) => c.id === id) as any).value.sources
    await w.find('[data-test="corridor-source-ALERT"]').setValue(false)
    expect(get()).toEqual(['PUBLISHED', 'REQUESTED'])
    await w.find('[data-test="corridor-source-ALERT"]').setValue(true)
    expect(get()).toEqual(['PUBLISHED', 'REQUESTED', 'ALERT'])
  })

  it('corridor_nouvelleCondition_toutesSourcesCocheesEtListeExplicite', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'corridor_interest')!
    await w.vm.$nextTick()
    for (const k of ['PUBLISHED', 'REQUESTED', 'ALERT']) {
      expect((w.find(`[data-test="corridor-source-${k}"]`).element as HTMLInputElement).checked).toBe(true)
    }
    await w.find('[data-test="corridor-origin"]').setValue('Paris')
    expect((rule.root.value.children.find((c) => c.id === id) as any).value.sources).toEqual(['PUBLISHED', 'REQUESTED', 'ALERT'])
  })

  it('corridor_sourcesNull_afficheesToutesCochees', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'corridor_interest')!
    rule.update(id, { value: { kind: 'CITY', origin: 'Paris', destination: '', sources: null } })
    await w.vm.$nextTick()
    for (const k of ['PUBLISHED', 'REQUESTED', 'ALERT']) {
      expect((w.find(`[data-test="corridor-source-${k}"]`).element as HTMLInputElement).checked).toBe(true)
    }
  })

  it('corridor_derniereSource_nePeutPasEtreDecochee', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'corridor_interest')!
    await w.vm.$nextTick()
    const get = () => (rule.root.value.children.find((c) => c.id === id) as any).value.sources
    await w.find('[data-test="corridor-source-PUBLISHED"]').setValue(false)
    await w.find('[data-test="corridor-source-REQUESTED"]').setValue(false)
    expect(get()).toEqual(['ALERT'])
    const last = w.find('[data-test="corridor-source-ALERT"]')
    expect((last.element as HTMLInputElement).disabled).toBe(true)
    await last.setValue(false)
    expect(get()).toEqual(['ALERT'])
  })

  it('retirerGroupe_etMessageGroupeVide', async () => {
    const { w, rule } = build()
    await w.find('[data-test="add-group"]').trigger('click')
    expect(w.text()).toContain('Ajoutez au moins une condition à ce groupe.')
    await w.find('[data-test="remove-group"]').trigger('click')
    expect(rule.root.value.children).toHaveLength(0)
    expect(w.find('[data-test="remove-group"]').exists()).toBe(false)
  })

  it('selecteurChamps_echapFermeEtRendLeFocus', async () => {
    const w = mount(AudienceRuleBuilder, { props: { fields, rule: useAudienceRule(fields) }, attachTo: document.body })
    await w.find('[data-test="add-condition"]').trigger('click')
    await w.find('[data-test="field-picker"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-test="field-picker"]').exists()).toBe(false)
    expect(document.activeElement).toBe(w.find('[data-test="add-condition"]').element)
    w.unmount()
  })

  it('limite30_messageUniqueRole_status', async () => {
    const { w, rule } = build()
    await w.find('[data-test="add-group"]').trigger('click')
    for (let i = 0; i < 30; i++) rule.addCondition(rule.root.value.id, 'is_pro')
    await w.vm.$nextTick()
    const msgs = w.findAll('[data-test="max-conditions"]')
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.attributes('role')).toBe('status')
  })
})
