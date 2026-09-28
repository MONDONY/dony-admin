import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/signalements/services/ratingsService')
import { useRatings } from '@/features/signalements/composables/useRatings'
import { ratingsService } from '@/features/signalements/services/ratingsService'
const svc = ratingsService as unknown as Record<string, ReturnType<typeof vi.fn>>

const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

describe('useRatings : avis supprimés et restauration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn().mockResolvedValue(page([]))
    svc.restore = vi.fn().mockResolvedValue({ id: 'rt1' })
  })

  it('setDeletedFilter bascule le filtre et recharge en page 0', async () => {
    svc.list.mockResolvedValue(page([{ id: 'rt1', deletedAt: '2026-09-20T10:00:00Z' }]))
    const r = useRatings()
    await r.goToPage(3)
    await r.setDeletedFilter(true)
    expect(r.filters.deleted).toBe(true)
    expect(r.currentPage.value).toBe(0)
    expect(r.ratings.value).toHaveLength(1)
    expect(r.deletedFilterUnsupported.value).toBe(false)
  })

  it('ancien back (aucun deletedAt sous le filtre) : liste vidée et signalée', async () => {
    svc.list.mockResolvedValue(page([{ id: 'rt1' }]))
    const r = useRatings()
    await r.setDeletedFilter(true)
    expect(r.deletedFilterUnsupported.value).toBe(true)
    expect(r.ratings.value).toEqual([])
    expect(r.totalPages.value).toBe(0)
  })

  it('restore envoie le motif, recharge et rend true', async () => {
    const r = useRatings()
    expect(await r.restore('rt1', 'avis légitime finalement')).toBe(true)
    expect(svc.restore).toHaveBeenCalledWith('rt1', 'avis légitime finalement')
    expect(svc.list).toHaveBeenCalled()
  })

  it('restore sur 409 rating-not-deleted affiche le detail', async () => {
    svc.restore.mockRejectedValue(Object.assign(new Error('409'), { statusCode: 409, data: { code: 'rating-not-deleted', detail: 'Cet avis n’est pas supprimé.' } }))
    const r = useRatings()
    expect(await r.restore('rt1', 'avis légitime finalement')).toBe(false)
    expect(r.error.value).toBe('Cet avis n’est pas supprimé.')
    expect(svc.list).toHaveBeenCalled()
  })

  it('restore sur endpoint absent masque l’action sans erreur', async () => {
    svc.restore.mockRejectedValue(Object.assign(new Error('405'), { statusCode: 405 }))
    const r = useRatings()
    expect(await r.restore('rt1', 'avis légitime finalement')).toBe(false)
    expect(r.restoreUnavailable.value).toBe(true)
    expect(r.error.value).toBeNull()
  })
})
