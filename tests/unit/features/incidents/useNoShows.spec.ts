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

  describe('pagination serveur', () => {
    const page = (number: number, totalPages = 3) => ({ content: [{ bidId: `b${number}` }], totalElements: 55, totalPages, number, size: 20 })

    it('retient le nombre de pages et la page courante', async () => {
      svc.listCancellations.mockResolvedValue(page(0))
      const n = useNoShows()
      await n.fetchCancellations()
      expect(n.totalPages.value).toBe(3)
      expect(n.currentPage.value).toBe(0)
    })

    it('goToPage charge la page demandée', async () => {
      svc.listCancellations.mockResolvedValueOnce(page(0)).mockResolvedValueOnce(page(2))
      const n = useNoShows()
      await n.fetchCancellations()
      await n.goToPage(2)
      expect(svc.listCancellations).toHaveBeenLastCalledWith('PENDING_CONFIRMATION', 2, 20)
      expect(n.currentPage.value).toBe(2)
      expect(n.cancellations.value).toEqual([{ bidId: 'b2' }])
    })

    it('goToPage garde la page affichée si le chargement échoue', async () => {
      svc.listCancellations.mockResolvedValueOnce(page(0)).mockRejectedValueOnce(new Error('down'))
      const n = useNoShows()
      await n.fetchCancellations()
      await n.goToPage(1)
      expect(n.currentPage.value).toBe(0)
      expect(n.error.value).toBe('down')
    })

    it('changer de filtre revient à la première page', async () => {
      svc.listCancellations.mockResolvedValueOnce(page(0)).mockResolvedValueOnce(page(2)).mockResolvedValueOnce(page(0, 1))
      const n = useNoShows()
      await n.fetchCancellations()
      await n.goToPage(2)
      await n.setFilter('CONFIRMED' as never)
      expect(svc.listCancellations).toHaveBeenLastCalledWith('CONFIRMED', 0, 20)
      expect(n.currentPage.value).toBe(0)
    })

    it('confirm recharge la page courante', async () => {
      svc.listCancellations.mockResolvedValueOnce(page(0)).mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(1))
      svc.confirmNoShow.mockResolvedValue(undefined)
      const n = useNoShows()
      await n.fetchCancellations()
      await n.goToPage(1)
      await n.confirm('b1')
      expect(svc.listCancellations).toHaveBeenLastCalledWith('PENDING_CONFIRMATION', 1, 20)
    })
  })
})

