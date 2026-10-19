import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { commissionGridService } from '@/features/commission-grid/services/commissionGridService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { violationsByField } from '@/lib/violations'
import { draftToRequest } from '@/features/commission-grid/utils/grid'
import { COMPARISON_NETS } from '@/features/commission-grid/types/index'
import type { CommissionGridWarning, GridDraft, SimulationRow } from '@/features/commission-grid/types/index'

export const COMPARISON_DEBOUNCE_MS = 400

/**
 * Tableau comparatif sous l'éditeur : à chaque saisie (après un temps de repos), `simulate` compare
 * le brouillon à la grille en vigueur sur les nets de `COMPARISON_NETS`, en euros. Aucune formule
 * de commission côté admin : tout vient du back, qui renvoie aussi les erreurs par champ du
 * brouillon (affichées en direct) et l'avertissement de hausse.
 *
 * Une réponse arrivée après une saisie plus récente est ignorée (numéro de séquence).
 */
export function useDraftComparison(draft: Ref<GridDraft | null>, delayMs = COMPARISON_DEBOUNCE_MS) {
  const rows = ref<SimulationRow[]>([])
  const warnings = ref<CommissionGridWarning[]>([])
  const violations = ref<Record<string, string>>({})
  const error = ref<string | null>(null)
  const unavailable = ref(false)
  const isLoading = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  async function run(): Promise<void> {
    clearTimer()
    const d = draft.value
    const mine = ++seq
    if (!d) {
      rows.value = []
      warnings.value = []
      violations.value = {}
      error.value = null
      isLoading.value = false
      return
    }
    isLoading.value = true
    try {
      const res = await commissionGridService.simulate({
        draft: draftToRequest(d), currency: 'EUR', nets: [...COMPARISON_NETS],
      })
      if (mine !== seq) return
      rows.value = res.rows ?? []
      warnings.value = res.warnings ?? []
      violations.value = {}
      error.value = null
      unavailable.value = false
    } catch (e) {
      if (mine !== seq) return
      rows.value = []
      warnings.value = []
      if (isEndpointMissing(e)) {
        unavailable.value = true
        return
      }
      violations.value = violationsByField(e)
      error.value = Object.keys(violations.value).length
        ? null
        : extractProblemMessage(e, 'La comparaison n’a pas pu être calculée')
    } finally {
      if (mine === seq) isLoading.value = false
    }
  }

  function schedule() {
    clearTimer()
    timer = setTimeout(() => { void run() }, delayMs)
  }

  watch(draft, (d) => {
    if (d) schedule()
    else void run()
  }, { deep: true, immediate: true })

  onScopeDispose(clearTimer)

  return { rows, warnings, violations, error, unavailable, isLoading, flush: run }
}
