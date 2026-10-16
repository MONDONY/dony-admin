import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { matchPages } from '../lib/searchPages'
import type { SearchPage } from '../lib/searchPages'
import { SEARCH_SOURCES } from '../services/globalSearchService'
import type { SearchGroup, SearchItem, SearchSource } from '../services/globalSearchService'

/** En dessous, la saisie ne cherche que dans les pages : deux lettres suffisent pour un nom. */
export const MIN_DATA_QUERY = 2
const DEBOUNCE_MS = 200

export interface GroupState { group: SearchGroup; label: string; loading: boolean; failed: boolean; items: SearchItem[] }

/**
 * État de la palette : pages filtrées tout de suite, données cherchées après une courte pause.
 * Un compteur de génération écarte les réponses d'une saisie dépassée.
 */
export function useGlobalSearch(sources: readonly SearchSource[] = SEARCH_SOURCES) {
  const auth = useAuthStore()
  const query = ref('')
  const groups = ref<GroupState[]>([])
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const can = (p: Parameters<typeof auth.can>[0]) => auth.can(p)
  const pages = computed<SearchPage[]>(() => matchPages(query.value, can))
  const allowedSources = computed(() => sources.filter(s => can(s.permission)))
  const searching = computed(() => groups.value.some(g => g.loading))

  async function runSearch(q: string) {
    const current = ++generation
    groups.value = allowedSources.value.map(s => ({ group: s.group, label: s.label, loading: true, failed: false, items: [] }))
    await Promise.all(allowedSources.value.map(async (source, index) => {
      let items: SearchItem[] = []
      let failed = false
      try {
        items = await source.run(q)
      }
      catch {
        failed = true
      }
      if (current !== generation) return
      groups.value[index] = { group: source.group, label: source.label, loading: false, failed, items }
    }))
  }

  watch(query, (value) => {
    if (timer) clearTimeout(timer)
    const q = value.trim()
    if (q.length < MIN_DATA_QUERY) {
      generation++
      groups.value = []
      return
    }
    timer = setTimeout(() => { void runSearch(q) }, DEBOUNCE_MS)
  })

  function reset() {
    if (timer) clearTimeout(timer)
    generation++
    query.value = ''
    groups.value = []
  }

  return { query, pages, groups, searching, reset, runSearch }
}
