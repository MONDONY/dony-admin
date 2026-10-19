import { ref } from 'vue'
import { commissionGridService } from '@/features/commission-grid/services/commissionGridService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { violationsByField } from '@/lib/violations'
import { draftToRequest } from '@/features/commission-grid/utils/grid'
import { COMMISSION_GRID_UNAVAILABLE } from '@/features/commission-grid/types/index'
import type { CommissionGrid, CommissionGridWarning, GridDraft } from '@/features/commission-grid/types/index'

export type ScheduleOutcome =
  | { status: 'scheduled'; grid: CommissionGrid }
  /** Le back exige l'acquittement d'avertissements que l'écran n'avait pas encore montrés. */
  | { status: 'needs-ack'; warnings: CommissionGridWarning[] }
  | { status: 'failed' }

const NOT_ACKNOWLEDGED = 'commission-grid-warning-not-acknowledged'

function warningsOf(e: unknown): CommissionGridWarning[] {
  const w = (e as { data?: { warnings?: unknown } } | undefined)?.data?.warnings
  return Array.isArray(w) ? w.filter((x): x is string => typeof x === 'string') : []
}

/**
 * Programmation d'une grille, en deux temps (contrat du back) :
 * 1. `prepare` demande à `simulate` les avertissements que lèverait le brouillon (et ses erreurs
 *    par champ) : l'écran choisit alors la confirmation simple ou la phrase « HAUSSE SANS PRÉAVIS » ;
 * 2. `schedule` poste la grille avec les avertissements acquittés. Si le back en exige d'autres
 *    (la grille en vigueur a changé entre-temps), il les renvoie : l'écran redemande confirmation.
 */
export function useScheduleGrid() {
  const busy = ref(false)
  const error = ref<string | null>(null)
  const violations = ref<Record<string, string>>({})

  function fail(e: unknown, fallback: string) {
    violations.value = violationsByField(e)
    if (isEndpointMissing(e)) error.value = COMMISSION_GRID_UNAVAILABLE
    else error.value = Object.keys(violations.value).length ? null : extractProblemMessage(e, fallback)
  }

  function reset() {
    error.value = null
    violations.value = {}
  }

  /** Avertissements du brouillon, ou `null` s'il est invalide (erreurs dans `violations`). */
  async function prepare(draft: GridDraft): Promise<CommissionGridWarning[] | null> {
    busy.value = true
    reset()
    try {
      const res = await commissionGridService.simulate({ draft: draftToRequest(draft), currency: 'EUR', nets: [100] })
      return res.warnings ?? []
    } catch (e) {
      fail(e, 'La grille n’a pas pu être vérifiée')
      return null
    } finally {
      busy.value = false
    }
  }

  async function schedule(draft: GridDraft, acknowledged: CommissionGridWarning[]): Promise<ScheduleOutcome> {
    busy.value = true
    reset()
    try {
      const grid = await commissionGridService.schedule(draftToRequest(draft, acknowledged))
      return { status: 'scheduled', grid }
    } catch (e) {
      if (problemCode(e) === NOT_ACKNOWLEDGED) {
        const warnings = warningsOf(e)
        if (warnings.length) return { status: 'needs-ack', warnings }
      }
      fail(e, 'La grille n’a pas pu être programmée')
      return { status: 'failed' }
    } finally {
      busy.value = false
    }
  }

  return { busy, error, violations, prepare, schedule, reset }
}
