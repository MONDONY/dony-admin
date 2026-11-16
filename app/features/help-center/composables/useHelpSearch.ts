import { getCurrentInstance, onBeforeUnmount, ref } from 'vue'
import { helpCenterService } from '@/features/help-center/services/helpCenterService'
import type { HelpSearchResult } from '@/features/help-center/types'
import { extractProblemMessage } from '@/lib/problemDetail'

export const SEARCH_DELAY_MS = 250
export const SEARCH_MAX_LENGTH = 200

/**
 * Recherche dans la doc pendant la frappe : une requête par pause, et seule la réponse de la dernière
 * requête est gardée (une réponse lente d'une frappe ancienne ne remplace pas la plus récente).
 */
export function useHelpSearch() {
  const query = ref('')
  const results = ref<HelpSearchResult[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Texte auquel `results` répond : « aucun résultat pour … » ne s'affiche qu'une fois la réponse reçue. */
  const answeredFor = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0

  async function run(text: string): Promise<void> {
    const q = text.trim().slice(0, SEARCH_MAX_LENGTH)
    const mine = ++seq
    if (!q) {
      results.value = []
      answeredFor.value = null
      isLoading.value = false
      error.value = null
      return
    }
    isLoading.value = true
    error.value = null
    try {
      const r = await helpCenterService.search(q)
      if (mine !== seq) return
      results.value = r.results
      answeredFor.value = q
    } catch (e) {
      if (mine !== seq) return
      error.value = extractProblemMessage(e, 'La recherche a échoué')
    } finally {
      if (mine === seq) isLoading.value = false
    }
  }

  function type(text: string) {
    query.value = text
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; void run(text) }, SEARCH_DELAY_MS)
  }

  /** Recherche immédiate (Entrée, lien `?q=`). */
  function now(text: string = query.value): Promise<void> {
    query.value = text
    if (timer) { clearTimeout(timer); timer = null }
    return run(text)
  }

  function clear() { void now('') }

  if (getCurrentInstance()) onBeforeUnmount(() => { if (timer) clearTimeout(timer) })

  return { query, results, isLoading, error, answeredFor, type, now, clear }
}
