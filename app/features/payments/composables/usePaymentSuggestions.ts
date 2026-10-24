import { onScopeDispose, getCurrentScope, ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import type { PaymentSuggest } from '@/features/payments/types/index'
import { isEndpointMissing } from '@/lib/endpointMissing'

const DEBOUNCE_MS = 200
const MIN_QUERY = 2

/** Suggestions de recherche : pause de 200 ms, 2 caractères minimum, réponses périmées écartées. */
export function usePaymentSuggestions() {
  const suggestions = ref<PaymentSuggest | null>(null)
  const unavailable = ref(false)
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  function stopTimer() {
    if (timer) { clearTimeout(timer); timer = null }
  }

  async function run(q: string) {
    const current = ++generation
    try {
      const res = await paymentsService.suggest(q)
      if (current !== generation) return
      suggestions.value = res
      unavailable.value = false
    } catch (e) {
      if (current !== generation) return
      suggestions.value = null
      if (isEndpointMissing(e)) unavailable.value = true
    }
  }

  function clear() {
    stopTimer()
    generation++
    suggestions.value = null
  }

  function query(q: string) {
    const value = q.trim()
    if (value.length < MIN_QUERY) { clear(); return }
    stopTimer()
    // Nouvelle frappe : une réponse encore en vol pour l'ancien texte ne s'affichera pas.
    generation++
    timer = setTimeout(() => { timer = null; void run(value) }, DEBOUNCE_MS)
  }

  if (getCurrentScope()) onScopeDispose(stopTimer)

  return { suggestions, unavailable, query, clear }
}
