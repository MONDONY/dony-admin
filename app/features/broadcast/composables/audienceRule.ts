import type { RuleCondition, RuleGroup, RuleOp } from '@/features/broadcast/types/index'

/** JSON échangé avec le back : sans `kind` ni `id`. */
export interface WireGroup { op: RuleOp; children: Array<WireGroup | WireCondition> }
export interface WireCondition { field: string; operator: string; value: unknown }

let seq = 0
export function newRuleId(): string {
  seq += 1
  return `r${Date.now().toString(36)}${seq}`
}

export function serializeRule(group: RuleGroup): WireGroup {
  return {
    op: group.op,
    children: group.children.map((c) =>
      c.kind === 'group'
        ? serializeRule(c)
        : { field: c.field, operator: c.operator, value: c.value ?? null }),
  }
}

/** Inverse de `serializeRule` : regénère des `id` locaux. */
export function parseRule(json: unknown): RuleGroup {
  const g = (json ?? {}) as { op?: string; children?: unknown[] }
  const children = Array.isArray(g.children) ? g.children : []
  return {
    kind: 'group',
    id: newRuleId(),
    op: g.op === 'OR' ? 'OR' : 'AND',
    children: children.map((c): RuleGroup | RuleCondition => {
      const o = c as { children?: unknown; field?: string; operator?: string; value?: unknown }
      if (Array.isArray(o.children)) return parseRule(o)
      return { kind: 'condition', id: newRuleId(), field: String(o.field ?? ''), operator: String(o.operator ?? ''), value: o.value ?? null }
    }),
  }
}
