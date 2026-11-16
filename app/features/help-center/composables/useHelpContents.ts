import { computed, ref } from 'vue'
import { helpCenterService } from '@/features/help-center/services/helpCenterService'
import type { HelpContents } from '@/features/help-center/types'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

// Sommaire partagé : la page d'aide et la bulle de l'assistant le lisent sans le recharger.
const contents = ref<HelpContents | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const unavailable = ref(false)
let inFlight: Promise<void> | null = null

export function useHelpContents() {
  async function load(force = false): Promise<void> {
    if (contents.value && !force) return
    if (inFlight) return inFlight
    isLoading.value = true
    error.value = null
    inFlight = (async () => {
      try {
        contents.value = await helpCenterService.contents()
        unavailable.value = false
      } catch (e) {
        unavailable.value = isEndpointMissing(e)
        if (!unavailable.value) error.value = extractProblemMessage(e, 'Impossible de charger le centre d’aide')
      } finally {
        isLoading.value = false
        inFlight = null
      }
    })()
    return inFlight
  }

  /** Rubriques dans l'ordre, chacune avec ses fiches ; une rubrique sans fiche n'apparaît pas. */
  const sections = computed(() => {
    const c = contents.value
    if (!c) return []
    return c.categories
      .map(cat => ({ ...cat, articles: c.articles.filter(a => a.category === cat.id) }))
      .filter(s => s.articles.length > 0)
  })

  const categoryLabel = (id: string) => contents.value?.categories.find(c => c.id === id)?.label ?? id

  return { contents, isLoading, error, unavailable, sections, categoryLabel, load }
}

/** Remise à zéro entre deux tests. */
export function _resetHelpContents(): void {
  contents.value = null
  isLoading.value = false
  error.value = null
  unavailable.value = false
  inFlight = null
}
