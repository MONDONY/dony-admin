import { describe, it, expect } from 'vitest'
import { useAudienceRule } from '@/features/broadcast/composables/useAudienceRule'
import { parseRule, serializeRule } from '@/features/broadcast/composables/audienceRule'
import type { AudienceField } from '@/features/broadcast/types/index'

const fields: AudienceField[] = [
  { key: 'created_request', family: 'ACTIVITY', label: 'A créé une demande', operators: [{ key: 'EVER', label: 'au moins une fois', valueType: 'NONE' }], values: [] },
  { key: 'bids_count', family: 'ACTIVITY', label: 'Demandes', operators: [{ key: 'GTE', label: 'au moins', valueType: 'INT' }], values: [] },
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
})
