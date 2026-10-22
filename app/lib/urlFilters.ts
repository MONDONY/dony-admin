/**
 * Filtres d'une liste conservés dans l'URL : un rechargement ou un retour arrière retrouve
 * la vue, et un lien « Transactions, mobile money, échecs » s'envoie à un collègue.
 * Logique pure, sans routeur : le composable `useUrlFilters` s'occupe de la branchance.
 */

export type FilterValue = string | boolean | null

export interface FilterSpec {
  /** Valeur quand le paramètre est absent de l'URL (et donc non écrite). */
  default: FilterValue
  /** Valeurs acceptées pour une chaîne ; toute autre est ignorée plutôt que passée au back. */
  allowed?: readonly string[]
  /** Nom du paramètre d'URL si différent de la clé du filtre. */
  param?: string
}

export type FilterSpecs<K extends string = string> = Record<K, FilterSpec>

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MAX_LEN = 120

const paramOf = (key: string, spec: FilterSpec) => spec.param ?? key

function first(v: unknown): string | undefined {
  const raw = Array.isArray(v) ? v[0] : v
  return typeof raw === 'string' ? raw : undefined
}

/** Valeurs lues dans l'URL, limitées aux clés présentes ET valides. */
export function readFilters<K extends string>(
  query: Record<string, unknown> | undefined,
  specs: FilterSpecs<K>,
): Partial<Record<K, FilterValue>> {
  const out: Partial<Record<K, FilterValue>> = {}
  if (!query) return out
  for (const key of Object.keys(specs) as K[]) {
    const spec = specs[key]
    const raw = first(query[paramOf(key, spec)])
    if (raw === undefined) continue
    if (typeof spec.default === 'boolean') {
      if (raw === 'true' || raw === 'false') out[key] = raw === 'true'
      continue
    }
    if (raw.length > MAX_LEN) continue
    if (spec.allowed && !spec.allowed.includes(raw)) continue
    // Les clés de date finissent par « From » / « To » : une date mal formée est ignorée.
    if (/(From|To)$/.test(key) && !DAY.test(raw)) continue
    out[key] = raw
  }
  return out
}

/** Nouvelle query : les autres paramètres sont conservés, les filtres à leur défaut retirés. */
export function writeFilters<K extends string>(
  query: Record<string, unknown> | undefined,
  values: Record<K, FilterValue>,
  specs: FilterSpecs<K>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(query ?? {}) }
  for (const key of Object.keys(specs) as K[]) {
    const spec = specs[key]
    const param = paramOf(key, spec)
    const value = values[key]
    if (value === spec.default || value === '' || value === null || value === undefined) delete next[param]
    else next[param] = String(value)
  }
  return next
}

/** Deux queries portent-elles les mêmes paramètres ? (évite un `replace` inutile à chaque frappe) */
export function sameQuery(a: Record<string, unknown> | undefined, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a ?? {})
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return kb.every(k => String(first((a ?? {})[k]) ?? '') === String(first(b[k]) ?? ''))
}
