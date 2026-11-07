import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AudienceRuleBuilder from '@/features/broadcast/components/AudienceRuleBuilder.vue'
import { useAudienceRule } from '@/features/broadcast/composables/useAudienceRule'
import type { AudienceField } from '@/features/broadcast/types/index'

const fields: AudienceField[] = [
  { key: 'bids_count', family: 'ACTIVITY', label: 'Demandes créées', operators: [{ key: 'GTE', label: 'au moins', valueType: 'INT' }], values: [] },
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
    const { w, rule } = build()
    expect(w.findAll('[data-test="add-group"]')).toHaveLength(1)
    await w.find('[data-test="add-group"]').trigger('click')
    expect(w.findAll('[data-test="add-group"]')).toHaveLength(2)
    await w.findAll('[data-test="add-group"]')[0]!.trigger('click')
    // profondeur 3 atteinte : seuls la racine et le niveau 2 gardent le bouton
    expect(w.findAll('[data-test="add-group"]')).toHaveLength(2)
    expect(rule.addGroup(rule.root.value.id)).toBe(true)
  })

  it('valueTypeInt_afficheChampNumerique', async () => {
    const { w, rule } = build()
    const id = rule.addCondition(rule.root.value.id, 'bids_count')!
    await w.vm.$nextTick()
    const input = w.find('input[type="number"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('min')).toBe('0')
    expect(input.attributes('max')).toBe('3650')
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
})
