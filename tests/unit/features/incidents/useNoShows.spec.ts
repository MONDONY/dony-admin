import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/incidents/services/incidentsService')
import { useNoShows } from '@/features/incidents/composables/useNoShows'
import { incidentsService } from '@/features/incidents/services/incidentsService'
const svc = incidentsService as any

describe('useNoShows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.listCancellations = vi.fn()
    svc.confirmNoShow = vi.fn()
  })

  it('charge les annulations du filtre courant', async () => {
    svc.listCancellations.mockResolvedValue({ content: [{ bidId: 'b1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const n = useNoShows()
    await n.fetchCancellations()
    expect(svc.listCancellations).toHaveBeenCalledWith('PENDING_CONFIRMATION', 0, 20)
    expect(n.cancellations.value).toHaveLength(1)
    expect(n.isLoading.value).toBe(false)
  })

  it('setFilter change le filtre et recharge', async () => {
    svc.listCancellations.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const n = useNoShows()
    await n.setFilter('CONFIRMED' as never)
    expect(svc.listCancellations).toHaveBeenCalledWith('CONFIRMED', 0, 20)
  })

  it('confirm confirme le no-show puis recharge', async () => {
    svc.listCancellations.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    svc.confirmNoShow.mockResolvedValue(undefined)
    const n = useNoShows()
    await n.confirm('b1')
    expect(svc.confirmNoShow).toHaveBeenCalledWith('b1')
    expect(svc.listCancellations).toHaveBeenCalledTimes(1)
  })

  it('affiche le detail du ProblemDetail plutôt que le message technique', async () => {
    svc.listCancellations.mockRejectedValue(Object.assign(new Error('500 Internal Server Error'), { data: { detail: 'Détail lisible du back' } }))
    const n = useNoShows()
    await n.fetchCancellations()
    expect(n.error.value).toBe('Détail lisible du back')
    expect(n.isLoading.value).toBe(false)
  })

  it('retombe sur un message de secours sans detail ni message', async () => {
    svc.listCancellations.mockRejectedValue({})
    const n = useNoShows()
    await n.fetchCancellations()
    expect(n.error.value).toBe('Impossible de charger les annulations')
  })
})
