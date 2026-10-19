import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { commissionGridService } from '@/features/commission-grid/services/commissionGridService'

const BODY = {
  tiers: [{ fromEur: 0, rate: 0.07 }], minimums: { EUR: '1' }, effectiveFrom: null, note: null, acknowledgedWarnings: [],
}

describe('commissionGridService', () => {
  beforeEach(() => { apiMock.mockReset(); apiMock.mockResolvedValue(undefined) })

  it('list() lit la grille en vigueur, la programmée et une page d’historique', async () => {
    await commissionGridService.list(2, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/commission-grids', { query: { page: 2, size: 20 } })
  })

  it('schedule() poste la grille', async () => {
    await commissionGridService.schedule(BODY)
    expect(apiMock).toHaveBeenCalledWith('/admin/commission-grids', { method: 'POST', body: BODY })
  })

  it('cancel() supprime la grille programmée par son id', async () => {
    await commissionGridService.cancel('g1')
    expect(apiMock).toHaveBeenCalledWith('/admin/commission-grids/g1', { method: 'DELETE' })
  })

  it('simulate() poste la simulation', async () => {
    const req = { gridId: 'g1', currency: 'EUR' as const, nets: [20] }
    await commissionGridService.simulate(req)
    expect(apiMock).toHaveBeenCalledWith('/admin/commission-grids/simulate', { method: 'POST', body: req })
  })
})
