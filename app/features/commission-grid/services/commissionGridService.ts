import { useApi } from '@/composables/useApi'
import type {
  CommissionGrid, CommissionGridList, CommissionGridRequest, SimulationRequest, SimulationResponse,
} from '@/features/commission-grid/types/index'

/** Grilles de commission par paliers (CONFIG_MANAGE), yadony-back #591. */
export const commissionGridService = {
  /** Grille en vigueur, grille programmée et historique paginé (annulées comprises). */
  list(page: number, size: number): Promise<CommissionGridList> {
    return useApi()<CommissionGridList>('/admin/commission-grids', { query: { page, size } })
  },
  /** Programme une grille ; remplace celle qui était programmée. */
  schedule(body: CommissionGridRequest): Promise<CommissionGrid> {
    return useApi()<CommissionGrid>('/admin/commission-grids', { method: 'POST', body })
  },
  /** Annule une grille programmée (409 si elle est déjà en vigueur). */
  cancel(id: string): Promise<void> {
    return useApi()<void>(`/admin/commission-grids/${id}`, { method: 'DELETE' })
  },
  simulate(body: SimulationRequest): Promise<SimulationResponse> {
    return useApi()<SimulationResponse>('/admin/commission-grids/simulate', { method: 'POST', body })
  },
}
