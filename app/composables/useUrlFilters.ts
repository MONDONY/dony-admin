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
) {
  const route = useRoute()
  const router = useRouter()

  function restore(): boolean {
    const found = readFilters(route?.query as Record<string, unknown> | undefined, specs)
    const keys = Object.keys(found) as K[]
    for (const k of keys) (filters as Record<K, unknown>)[k] = found[k]
    return keys.length > 0
  }

  function sync() {
    const values = {} as Record<K, FilterValue>
    for (const k of Object.keys(specs) as K[]) values[k] = (filters as Record<K, FilterValue>)[k]
    const next = writeFilters(route?.query as Record<string, unknown> | undefined, values, specs)
    if (sameQuery(route?.query as Record<string, unknown> | undefined, next)) return
    void router?.replace?.({ query: next as LocationQueryRaw })
  }

  watch(() => Object.keys(specs).map(k => (filters as Record<string, unknown>)[k]), sync)

  return { restore, sync }
}
