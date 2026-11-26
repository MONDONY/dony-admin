import { useApi } from '@/composables/useApi'
import type { AdminOverview, OverviewPeriod } from '@/features/overview/types/index'

export const overviewService = {
  /**
   * Sans argument : appel historique du tableau de bord (aucun paramètre). Avec `period`, le back
   * ajoute le bloc `period` (mobile) ; un ancien back ignore le paramètre et n'envoie pas le bloc.
   */
  fetch(period?: OverviewPeriod): Promise<AdminOverview> {
    if (!period) return useApi()<AdminOverview>('/admin/metrics/overview')
    return useApi()<AdminOverview>('/admin/metrics/overview', { query: { period } })
  },
}
