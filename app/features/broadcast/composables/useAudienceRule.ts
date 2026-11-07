import { computed, ref, unref, type MaybeRef } from 'vue'
import {
  RULE_MAX_CONDITIONS, RULE_MAX_DEPTH,
  type AudienceField, type AudienceValueType, type RuleCondition, type RuleGroup, type RuleOp,
} from '@/features/broadcast/types/index'
import { newRuleId, parseRule } from '@/features/broadcast/composables/audienceRule'

function emptyRoot(): RuleGroup {
  return { kind: 'group', id: newRuleId(), op: 'AND', children: [] }
}

const MAX_TEXT = 100
const CORRIDOR_KINDS = ['CITY', 'COUNTRY']
const CORRIDOR_SOURCES = ['PUBLISHED', 'REQUESTED', 'ALERT']
const DAY_OPERATORS = ['WITHIN_DAYS', 'OLDER_THAN_DAYS']

function text(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TEXT
}

/** Valeur valide : miroir de la validation du back (qui reste juge). */
function validValue(type: AudienceValueType, value: unknown, operator: string, field: AudienceField | undefined): boolean {
  const keys = (field?.values ?? []).map((v) => v.key)
  switch (type) {
    case 'NONE': return value == null
    case 'BOOLEAN': return typeof value === 'boolean'
    case 'ENUM': return typeof value === 'string' && keys.includes(value)
    case 'TEXT': return text(value)
    case 'ENUM_MULTI':
      return Array.isArray(value) && value.length > 0 && value.every((x) => typeof x === 'string' && keys.includes(x))
    case 'INT': {
      const max = DAY_OPERATORS.includes(operator) ? 3650 : 10000
      return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
    }
    case 'CORRIDOR': {
      const v = value as { kind?: unknown; origin?: unknown; destination?: unknown; sources?: unknown } | null
      if (!v || typeof v !== 'object' || !CORRIDOR_KINDS.includes(v.kind as string)) return false
      for (const b of [v.origin, v.destination]) {
        if (b != null && (typeof b !== 'string' || b.length > MAX_TEXT)) return false
      }
      const hasBound = [v.origin, v.destination].some((b) => typeof b === 'string' && b.trim().length > 0)
      if (!hasBound) return false
      if (v.sources == null) return true
      return Array.isArray(v.sources) && v.sources.length > 0
        && v.sources.every((x) => CORRIDOR_SOURCES.includes(x as string))
    }
    default: return false
  }
}

/* eslint-disable no-unused-vars -- noms de paramètres d'un type de fonction */
type Visitor = (node: RuleGroup | RuleCondition, parent: RuleGroup | null) => void
/* eslint-enable no-unused-vars */

function walk(group: RuleGroup, fn: Visitor, parent: RuleGroup | null = null) {
  fn(group, parent)
  for (const c of group.children) {
    if (c.kind === 'group') walk(c, fn, group)
    else fn(c, group)
  }
}

function findGroup(root: RuleGroup, id: string): RuleGroup | null {
  let found: RuleGroup | null = null
  walk(root, (n) => { if (n.kind === 'group' && n.id === id) found = n })
  return found
}

/** Profondeur d'un groupe : la racine compte pour 1. */
function depthOf(root: RuleGroup, id: string): number {
  const visit = (g: RuleGroup, d: number): number => {
    if (g.id === id) return d
    for (const c of g.children) {
      if (c.kind === 'group') {
        const r = visit(c, d + 1)
        if (r > 0) return r
      }
    }
    return 0
  }
  return visit(root, 1)
}

/**
 * État du constructeur de règles. `fields` (catalogue du back) sert à connaître le type de
 * valeur de chaque couple (champ, opérateur) pour `isComplete`.
 */
export function useAudienceRule(fields: MaybeRef<AudienceField[]> = []) {
  const root = ref<RuleGroup>(emptyRoot())

  function valueTypeOf(c: RuleCondition): AudienceValueType | null {
    const f = unref(fields).find((x) => x.key === c.field)
    return f?.operators.find((o) => o.key === c.operator)?.valueType ?? null
  }

  const conditionCount = computed(() => {
    let n = 0
    walk(root.value, (node) => { if (node.kind === 'condition') n += 1 })
    return n
  })
  const canAddCondition = computed(() => conditionCount.value < RULE_MAX_CONDITIONS)

  const isComplete = computed(() => {
    let ok = true
    let sawEmptySubgroup = false
    walk(root.value, (node, parent) => {
      if (node.kind === 'condition') {
        const t = valueTypeOf(node)
        const field = unref(fields).find((x) => x.key === node.field)
        if (t === null || !validValue(t, node.value, node.operator, field)) ok = false
      } else if (parent && node.children.length === 0) {
        sawEmptySubgroup = true
      }
    })
    return ok && !sawEmptySubgroup
  })

  /** Ajoute une condition avec le premier opérateur du champ. Retourne son id, ou null si refusé. */
  function addCondition(groupId: string, fieldKey: string): string | null {
    if (!canAddCondition.value) return null
    const group = findGroup(root.value, groupId)
    if (!group) return null
    const field = unref(fields).find((f) => f.key === fieldKey)
    const condition: RuleCondition = {
      kind: 'condition', id: newRuleId(), field: fieldKey, operator: field?.operators[0]?.key ?? '', value: null,
    }
    group.children.push(condition)
    return condition.id
  }

  /** Refusé (false) au-delà de la profondeur 3. */
  function addGroup(groupId: string): boolean {
    const depth = depthOf(root.value, groupId)
    if (depth === 0 || depth >= RULE_MAX_DEPTH) return false
    const group = findGroup(root.value, groupId)
    if (!group) return false
    group.children.push({ kind: 'group', id: newRuleId(), op: 'AND', children: [] })
    return true
  }

  function remove(id: string) {
    if (id === root.value.id) return
    walk(root.value, (node) => {
      if (node.kind === 'group') node.children = node.children.filter((c) => c.id !== id)
    })
  }

  function update(id: string, patch: Partial<Pick<RuleCondition, 'field' | 'operator' | 'value'>>) {
    walk(root.value, (node) => {
      if (node.kind !== 'condition' || node.id !== id) return
      const fieldChanged = patch.field !== undefined && patch.field !== node.field
      const operatorChanged = patch.operator !== undefined && patch.operator !== node.operator
      Object.assign(node, patch)
      if (fieldChanged) {
        // Nouveau champ : premier opérateur, et valeur repartie de zéro (sauf valeur fournie).
        if (patch.operator === undefined) node.operator = unref(fields).find((f) => f.key === node.field)?.operators[0]?.key ?? ''
        if (patch.value === undefined) node.value = null
      } else if (operatorChanged && patch.value === undefined) {
        node.value = null
      }
    })
  }

  function setOp(groupId: string, op: RuleOp) {
    const group = findGroup(root.value, groupId)
    if (group) group.op = op
  }

  function load(rule: unknown) { root.value = parseRule(rule) }
  function reset() { root.value = emptyRoot() }

  function preset(field: string, operator: string, value: unknown = null) {
    root.value = {
      ...emptyRoot(),
      children: [{ kind: 'condition', id: newRuleId(), field, operator, value }],
    }
  }
  const presetAll = reset
  const presetSenders = () => preset('created_request', 'EVER')
  const presetTravelers = () => preset('published_trip', 'EVER')
  const presetCorridor = (origin: string, destination: string) =>
    preset('corridor_interest', 'MATCHES', { kind: 'CITY', origin, destination, sources: ['PUBLISHED', 'REQUESTED'] })

  return {
    root, conditionCount, canAddCondition, isComplete,
    addCondition, addGroup, remove, update, setOp, load, reset,
    presetAll, presetSenders, presetTravelers, presetCorridor,
  }
}
