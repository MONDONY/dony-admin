import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/signalements/services/ratingsService')
import { useRatings } from '@/features/signalements/composables/useRatings'
import { ratingsService } from '@/features/signalements/services/ratingsService'
const svc = ratingsService as any

describe('useRatings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn()
    svc.exclude = vi.fn()
    svc.remove = vi.fn()
  })

  it('fetchRatings loads page', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'rt1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const r = useRatings()
    await r.fetchRatings()
    expect(r.ratings.value).toHaveLength(1)
  })

  it('setFlaggedOnly resets page and reloads', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const r = useRatings()
    await r.goToPage(2)
    await r.setFlaggedOnly(true)
    expect(r.currentPage.value).toBe(0)
    expect(r.filters.flaggedOnly).toBe(true)
  })

  it('exclude calls service then refetches', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    svc.exclude.mockResolvedValue({ id: 'rt1', excluded: true })
    const r = useRatings()
    await r.exclude('rt1', true, 'diffamatoire')
    expect(svc.exclude).toHaveBeenCalledWith('rt1', true, 'diffamatoire')
    expect(svc.list).toHaveBeenCalled()
  })

  it('remove calls service then refetches', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    svc.remove.mockResolvedValue(undefined)
    const r = useRatings()
    await r.remove('rt1', 'spam')
    expect(svc.remove).toHaveBeenCalledWith('rt1', 'spam')
    expect(svc.list).toHaveBeenCalled()
  })

  it('captures errors', async () => {
    svc.list.mockRejectedValue(new Error('nope'))
    const r = useRatings()
    await r.fetchRatings()
    expect(r.error.value).toBe('nope')
  })

  it('préfère le detail du ProblemDetail au message technique', async () => {
    svc.list.mockRejectedValue(Object.assign(new Error('403 Forbidden'), { data: { detail: 'Accès refusé' } }))
    const r = useRatings()
    await r.fetchRatings()
    expect(r.error.value).toBe('Accès refusé')
  })

  describe('remove en échec', () => {
    it('attrape l’erreur, expose le detail du ProblemDetail et ne recharge pas', async () => {
      svc.remove.mockRejectedValue(Object.assign(new Error('409 Conflict'), { data: { detail: 'Avis déjà supprimé' } }))
      const r = useRatings()
      const ok = await r.remove('rt1', 'spam')
      expect(ok).toBe(false)
      expect(r.error.value).toBe('Avis déjà supprimé')
      expect(svc.list).not.toHaveBeenCalled()
    })

    it('retombe sur un message de secours en français', async () => {
      svc.remove.mockRejectedValue({})
      const r = useRatings()
      await r.remove('rt1', 'spam')
      expect(r.error.value).toBe('Impossible de supprimer cet avis')
    })

    it('renvoie true et efface l’erreur précédente en cas de succès', async () => {
      svc.remove.mockRejectedValueOnce({}).mockResolvedValueOnce(undefined)
      svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
      const r = useRatings()
      await r.remove('rt1', 'spam')
      expect(await r.remove('rt1', 'spam')).toBe(true)
      expect(r.error.value).toBeNull()
    })
  })
})

