import { describe, it, expect, vi, beforeEach } from 'vitest'

const svc = vi.hoisted(() => ({ list: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), simulate: vi.fn() }))
vi.mock('@/features/commission-grid/services/commissionGridService', () => ({ commissionGridService: svc }))

import { useCommissionGrids, HISTORY_PAGE_SIZE } from '@/features/commission-grid/composables/useCommissionGrids'
import { GRID, SCHEDULED, httpError } from './fixtures'

const page = (content = [GRID], p = 0) => ({ content, page: p, size: 20, totalElements: 7, totalPages: 2, last: false })

describe('useCommissionGrids', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('load lit la grille en vigueur, la programmée et la page d’historique', async () => {
    svc.list.mockResolvedValue({ current: GRID, scheduled: SCHEDULED, history: page([SCHEDULED, GRID], 1) })
    const g = useCommissionGrids()
    await g.load(1)
    expect(svc.list).toHaveBeenCalledWith(1, HISTORY_PAGE_SIZE)
    expect(g.current.value?.id).toBe('g-current')
    expect(g.scheduled.value?.id).toBe('g-next')
    expect(g.history.value).toHaveLength(2)
    expect(g.currentPage.value).toBe(1)
    expect(g.totalPages.value).toBe(2)
    expect(g.totalElements.value).toBe(7)
    expect(g.loaded.value).toBe(true)
    expect(g.isLoading.value).toBe(false)
  })

  it('champs absents (sérialisation NON_NULL) = aucune grille', async () => {
    svc.list.mockResolvedValue({ history: undefined })
    const g = useCommissionGrids()
    await g.load()
    expect(g.current.value).toBeNull()
    expect(g.scheduled.value).toBeNull()
    expect(g.history.value).toEqual([])
    expect(g.totalPages.value).toBe(0)
    expect(g.currentPage.value).toBe(0)
  })

  it('endpoint absent → unavailable, pas d’erreur', async () => {
    svc.list.mockRejectedValue(httpError(404))
    const g = useCommissionGrids()
    await g.load()
    expect(g.unavailable.value).toBe(true)
    expect(g.error.value).toBeNull()
  })

  it('autre erreur → message du ProblemDetail', async () => {
    svc.list.mockRejectedValue(httpError(500, { detail: 'Base indisponible' }))
    const g = useCommissionGrids()
    await g.load()
    expect(g.error.value).toBe('Base indisponible')
    expect(g.loaded.value).toBe(false)
  })

  it('cancel annule, affiche un message et relit', async () => {
    svc.list.mockResolvedValue({ current: GRID, history: page() })
    svc.cancel.mockResolvedValue(undefined)
    const g = useCommissionGrids()
    expect(await g.cancel('g-next')).toBe(true)
    expect(svc.cancel).toHaveBeenCalledWith('g-next')
    expect(g.message.value).toBe('La grille programmée est annulée.')
    expect(svc.list).toHaveBeenCalledTimes(1)
    expect(g.cancelling.value).toBe(false)
  })

  it('cancel refusé (409 déjà en vigueur) : erreur affichée et liste relue', async () => {
    svc.list.mockResolvedValue({ current: SCHEDULED, history: page() })
    svc.cancel.mockRejectedValue(httpError(409, { code: 'commission-grid-already-effective', detail: 'Déjà en vigueur' }))
    const g = useCommissionGrids()
    expect(await g.cancel('g-next')).toBe(false)
    expect(g.error.value).toBe('Déjà en vigueur')
    expect(g.message.value).toBeNull()
    expect(svc.list).toHaveBeenCalledTimes(1)
  })

  it('onScheduled : « en vigueur » si la grille l’est déjà, sinon « programmée »', async () => {
    const g = useCommissionGrids()
    svc.list.mockResolvedValue({ current: GRID, history: page() })
    await g.onScheduled(GRID)
    expect(g.message.value).toBe('La nouvelle grille est en vigueur.')
    expect(svc.list).toHaveBeenLastCalledWith(0, HISTORY_PAGE_SIZE)

    svc.list.mockResolvedValue({ current: GRID, scheduled: SCHEDULED, history: page() })
    await g.onScheduled(SCHEDULED)
    expect(g.message.value).toBe('La nouvelle grille est programmée.')
  })
})
