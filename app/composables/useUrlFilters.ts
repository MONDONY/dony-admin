import { watch } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { readFilters, sameQuery, writeFilters, type FilterSpecs, type FilterValue } from '@/lib/urlFilters'

/**
 * Relie un objet de filtres réactif à l'URL.
 *
 * - `restore()` : à appeler avant le premier chargement ; copie dans `filters` ce que l'URL
 *   porte et renvoie `true` s'il y avait quelque chose (pour ne pas écraser par un défaut).
 * - ensuite chaque changement de filtre réécrit la query avec `router.replace` (pas de pile
 *   d'historique : un retour arrière quitte la page, il ne rejoue pas chaque frappe).
 */
export function useUrlFilters<F extends object, K extends keyof F & string>(
  filters: F,
  specs: FilterSpecs<K>,
  /** `enabled` : la page n'écrit l'URL que tant qu'il renvoie vrai (liste affichée dans un onglet, pas dans un autre). */
  opts: { enabled?: () => boolean } = {},
) {
  const route = useRoute()
  const router = useRouter()

  function restore(): boolean {
    const found = readFilters(route?.query as Record<string, unknown> | undefined, specs)
    const keys = Object.keys(found) as K[]
    for (const k of keys) (filters as Record<K, unknown>)[k] = found[k]
    return keys.length > 0
  }

  /** `query` complétée des filtres courants : pour une page qui réécrit elle-même la query (onglet, fiche). */
  function apply(query: Record<string, unknown> | undefined): Record<string, unknown> {
    const values = {} as Record<K, FilterValue>
    for (const k of Object.keys(specs) as K[]) values[k] = (filters as Record<K, FilterValue>)[k]
    return writeFilters(query, values, specs)
  }

  function sync() {
    if (opts.enabled && !opts.enabled()) return
    const next = apply(route?.query as Record<string, unknown> | undefined)
    if (sameQuery(route?.query as Record<string, unknown> | undefined, next)) return
    void router?.replace?.({ query: next as LocationQueryRaw })
  }

  watch(() => Object.keys(specs).map(k => (filters as Record<string, unknown>)[k]), sync)

  return { restore, sync, apply }
}
