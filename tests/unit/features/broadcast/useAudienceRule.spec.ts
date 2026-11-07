import { describe, it, expect } from 'vitest'
import { useAudienceRule } from '@/features/broadcast/composables/useAudienceRule'
import { parseRule, serializeRule } from '@/features/broadcast/composables/audienceRule'
import type { AudienceField } from '@/features/broadcast/types/index'

const fields: AudienceField[] = [
  { key: 'created_request', family: 'ACTIVITY', label: 'A créé une demande', operators: [{ key: 'EVER', label: 'au moins une fois', valueType: 'NONE' }, { key: 'WITHIN_DAYS', label: 'récemment', valueType: 'INT' }], values: [] },
  { key: 'bids_count', family: 'ACTIVITY', label: 'Demandes', operators: [{ key: 'GTE', label: 'au moins', valueType: 'INT' }, { key: 'EVER', label: 'au moins une fois', valueType: 'NONE' }], values: [] },
  { key: 'is_pro', family: 'STATUS', label: 'Pro', operators: [{ key: 'IS', label: 'est', valueType: 'BOOLEAN' }], values: [] },
  { key: 'lang', family: 'STATUS', label: 'Langue', operators: [{ key: 'IS', label: 'est', valueType: 'ENUM' }], values: [{ key: 'fr', label: 'Français' }] },
  { key: 'city', family: 'GEO', label: 'Ville', operators: [{ key: 'IS', label: 'est', valueType: 'TEXT' }], values: [] },
  { key: 'corridor_interest', family: 'GEO', label: 'Corridor', operators: [{ key: 'MATCHES', label: 'correspond', valueType: 'CORRIDOR' }], values: [] },
  { key: 'country', family: 'GEO', label: 'Pays', operators: [{ key: 'IN', label: 'parmi', valueType: 'ENUM_MULTI' }], values: [{ key: 'FR', label: 'France' }] },
]

describe('serializeRule / parseRule', () => {
  it('serializeRule_roundTrip', () => {
    const wire = { op: 'OR', children: [
      { field: 'bids_count', operator: 'GTE', value: 3 },
      { op: 'AND', children: [{ field: 'country', operator: 'IN', value: ['FR'] }] },
    ] }
    const parsed = parseRule(wire)
    expect(parsed.kind).toBe('group')
    expect(parsed.id).toBeTruthy()
    expect(serializeRule(parsed)).toEqual(wire)
  })
})

describe('useAudienceRule', () => {
  it('addGroup_refuseProfondeur4', () => {
    const r = useAudienceRule(fields)
    expect(r.addGroup(r.root.value.id)).toBe(true)
    const g2 = r.root.value.children[0]!.id
    expect(r.addGroup(g2)).toBe(true)
    const g3 = (r.root.value.children[0] as any).children[0].id
    expect(r.addGroup(g3)).toBe(false)
  })

  it('canAddCondition_fauxA30', () => {
    const r = useAudienceRule(fields)
    for (let i = 0; i < 30; i++) r.addCondition(r.root.value.id, 'created_request')
    expect(r.conditionCount.value).toBe(30)
    expect(r.canAddCondition.value).toBe(false)
    expect(r.addCondition(r.root.value.id, 'created_request')).toBeNull()
    expect(r.conditionCount.value).toBe(30)
  })

  it('isComplete_fauxSiValeurIntManquante', () => {
    const r = useAudienceRule(fields)
    const id = r.addCondition(r.root.value.id, 'bids_count')!
    expect(r.isComplete.value).toBe(false)
    r.update(id, { value: 3 })
    expect(r.isComplete.value).toBe(true)
    r.update(id, { value: 1.5 })
    expect(r.isComplete.value).toBe(false)
  })

  it('isComplete exige une liste non vide pour ENUM_MULTI et accepte NONE', () => {
    const r = useAudienceRule(fields)
    r.addCondition(r.root.value.id, 'created_request')
    const id = r.addCondition(r.root.value.id, 'country')!
    expect(r.isComplete.value).toBe(false)
    r.update(id, { value: ['FR'] })
    expect(r.isComplete.value).toBe(true)
  })

  it('presetSenders_egalCreatedRequestEver', () => {
    const r = useAudienceRule(fields)
    r.presetSenders()
    expect(serializeRule(r.root.value)).toEqual({ op: 'AND', children: [{ field: 'created_request', operator: 'EVER', value: null }] })
    r.presetTravelers()
    expect(serializeRule(r.root.value).children[0]).toEqual({ field: 'published_trip', operator: 'EVER', value: null })
    r.presetAll()
    expect(serializeRule(r.root.value)).toEqual({ op: 'AND', children: [] })
    r.presetCorridor('Paris', 'Dakar')
    expect(serializeRule(r.root.value).children[0]).toEqual({
      field: 'corridor_interest', operator: 'MATCHES',
      value: { kind: 'CITY', origin: 'Paris', destination: 'Dakar', sources: ['PUBLISHED', 'REQUESTED'] },
    })
  })

  it('remove, setOp, load et reset', () => {
    const r = useAudienceRule(fields)
    const id = r.addCondition(r.root.value.id, 'created_request')!
    r.setOp(r.root.value.id, 'OR')
    expect(r.root.value.op).toBe('OR')
    r.remove(id)
    expect(r.conditionCount.value).toBe(0)
    r.load({ op: 'AND', children: [{ field: 'bids_count', operator: 'GTE', value: 2 }] })
    expect(r.conditionCount.value).toBe(1)
    r.reset()
    expect(r.root.value.children).toEqual([])
    expect(r.root.value.op).toBe('AND')
  })

  function single(fieldKey: string, operator: string | null, value: unknown) {
    const r = useAudienceRule(fields)
    const id = r.addCondition(r.root.value.id, fieldKey)!
    r.update(id, operator ? { operator, value } : { value })
    return r
  }

  it('update : changer d’opérateur réinitialise la valeur', () => {
    const r = single('bids_count', null, 3)
    const id = (r.root.value.children[0] as any).id
    expect(r.isComplete.value).toBe(true)
    r.update(id, { operator: 'EVER' })
    expect((r.root.value.children[0] as any).value).toBeNull()
    expect(r.isComplete.value).toBe(true)
  })

  it('update : changer de champ prend le premier opérateur et vide la valeur', () => {
    const r = single('bids_count', null, 3)
    const id = (r.root.value.children[0] as any).id
    r.update(id, { field: 'lang' })
    const c = r.root.value.children[0] as any
    expect(c.operator).toBe('IS')
    expect(c.value).toBeNull()
  })

  it('NONE refuse une valeur non nulle', () => {
    expect(single('created_request', 'EVER', 'x').isComplete.value).toBe(false)
  })

  it('isComplete TEXT, BOOLEAN, ENUM', () => {
    expect(single('city', null, 'Paris').isComplete.value).toBe(true)
    expect(single('city', null, '  ').isComplete.value).toBe(false)
    expect(single('city', null, 'a'.repeat(101)).isComplete.value).toBe(false)
    expect(single('is_pro', null, false).isComplete.value).toBe(true)
    expect(single('is_pro', null, 'oui').isComplete.value).toBe(false)
    expect(single('lang', null, 'fr').isComplete.value).toBe(true)
    expect(single('lang', null, 'zz').isComplete.value).toBe(false)
  })

  it('isComplete ENUM_MULTI : clés connues et non vide', () => {
    expect(single('country', null, ['FR']).isComplete.value).toBe(true)
    expect(single('country', null, ['XX']).isComplete.value).toBe(false)
    expect(single('country', null, []).isComplete.value).toBe(false)
  })

  it('isComplete INT : bornes selon l’opérateur', () => {
    expect(single('bids_count', null, 10000).isComplete.value).toBe(true)
    expect(single('bids_count', null, 10001).isComplete.value).toBe(false)
    expect(single('created_request', 'WITHIN_DAYS', 3650).isComplete.value).toBe(true)
    expect(single('created_request', 'WITHIN_DAYS', 3651).isComplete.value).toBe(false)
    expect(single('bids_count', null, -1).isComplete.value).toBe(false)
  })

  it('isComplete CORRIDOR valide et invalides', () => {
    const ok = { kind: 'CITY', origin: 'Paris', destination: '', sources: ['PUBLISHED'] }
    expect(single('corridor_interest', null, ok).isComplete.value).toBe(true)
    expect(single('corridor_interest', null, { kind: 'COUNTRY', origin: 'FR' }).isComplete.value).toBe(true)
    expect(single('corridor_interest', null, { ...ok, kind: 'REGION' }).isComplete.value).toBe(false)
    expect(single('corridor_interest', null, { kind: 'CITY', origin: ' ', destination: '' }).isComplete.value).toBe(false)
    expect(single('corridor_interest', null, { ...ok, origin: 'a'.repeat(101) }).isComplete.value).toBe(false)
    expect(single('corridor_interest', null, { ...ok, sources: [] }).isComplete.value).toBe(false)
    expect(single('corridor_interest', null, { ...ok, sources: ['X'] }).isComplete.value).toBe(false)
    expect(single('corridor_interest', null, null).isComplete.value).toBe(false)
  })

  it('isComplete faux : sous-groupe vide, champ inconnu', () => {
    const r = useAudienceRule(fields)
    r.addGroup(r.root.value.id)
    expect(r.isComplete.value).toBe(false)
    const r2 = useAudienceRule(fields)
    r2.addCondition(r2.root.value.id, 'inconnu')
    expect(r2.isComplete.value).toBe(false)
  })
})

describe('parseRule : entrées dégradées', () => {
  it('op absent : ET par défaut ; règle nulle : groupe vide', () => {
    expect(parseRule({ children: [] }).op).toBe('AND')
    const g = parseRule(null)
    expect(g.op).toBe('AND')
    expect(g.children).toEqual([])
  })

  it('un enfant qui n’est pas un objet devient une condition vide plutôt que de planter', () => {
    const g = parseRule({ op: 'OR', children: [null, 'x'] })
    expect(g.op).toBe('OR')
    expect(g.children).toHaveLength(2)
    expect(g.children[0]).toMatchObject({ kind: 'condition', field: '', operator: '', value: null })
  })
})
