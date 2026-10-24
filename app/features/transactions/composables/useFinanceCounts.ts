import { computed, ref } from 'vue'
import { transactionsService } from '@/features/transactions/services/transactionsService'
import type { FinanceCounts } from '@/features/transactions/types'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

/**
 * Pastilles des sections. Endpoint absent (ancien back) = indisponible, `counts = null` : la page
 * retombe sur les sept onglets plats (`flat`). Toute autre erreur garde les derniers nombres, sans
 * lever, et la signale dans `error`. Seule la réponse du dernier appel compte (rechargements qui se
 * chevauchent). En attente de la première réponse, `flat` reste faux : les quatre sections
 * s'affichent sans pastille, sans basculer d'une barre à l'autre quand les nombres arrivent.
 */
export function useFinanceCounts() {
  const counts = ref<FinanceCounts | null>(null)
  const unavailable = ref(false)
  const error = ref<string | null>(null)
  /** Sept onglets plats : pas de nombres ET le back a répondu sans (absent, ou en échec). */
  const flat = computed(() => counts.value === null && (unavailable.value || error.value !== null))
  let seq = 0
  let pending: Promise<void> | null = null

  function reload(): Promise<void> {
    pending = run()
    return pending
  }
  /** Nombres du dernier chargement (en cours, ou lancé s'il n'y en a pas eu) : pour décider d'une vue par défaut. */
  function settled(): Promise<void> { return pending ?? reload() }

  async function run(): Promise<void> {
    const my = ++seq
    try {
      const res = await transactionsService.counts()
      if (my !== seq) return
      counts.value = res
      unavailable.value = false
      error.value = null
    } catch (e) {
      if (my !== seq) return
      if (isEndpointMissing(e)) { unavailable.value = true; counts.value = null; error.value = null }
      else error.value = extractProblemMessage(e, 'Impossible de charger les nombres des sections')
    }
  }

  return { counts, unavailable, error, flat, reload, settled }
}
