import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRatingContext } from '@/features/signalements/composables/useRatingContext'
import { ratingsService } from '@/features/signalements/services/ratingsService'

vi.mock('@/features/signalements/services/ratingsService', () => ({
  ratingsService: { getContext: vi.fn() },
}))
const getContext = vi.mocked(ratingsService.getContext)

describe('useRatingContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('charge le contexte de l’avis', async () => {
    getContext.mockResolvedValue({ sameRelationCount: 2, openReports: 1, reports: [], history: [] })
    const c = useRatingContext()
    await c.load('rt1')
    expect(getContext).toHaveBeenCalledWith('rt1')
    expect(c.context.value).toMatchObject({ sameRelationCount: 2, openReports: 1 })
    expect(c.unavailable.value).toBe(false)
  })

  it('une réponse sans les deux compteurs n’est pas un contexte d’avis', async () => {
    getContext.mockResolvedValue({ content: [] } as never)
    const c = useRatingContext()
    await c.load('rt1')
    expect(c.context.value).toBeNull()
    expect(c.unavailable.value).toBe(true)
    getContext.mockResolvedValue(null as never)
    await c.load('rt2')
    expect(c.context.value).toBeNull()
    getContext.mockResolvedValue({ sameRelationCount: '2', openReports: 1 } as never)
    await c.load('rt3')
    expect(c.context.value).toBeNull()
  })

  it('ancien back (404 sans code) : indisponible, sans erreur', async () => {
    getContext.mockRejectedValue({ statusCode: 404, data: {} })
    const c = useRatingContext()
    await c.load('rt1')
    expect(c.unavailable.value).toBe(true)
    expect(c.error.value).toBeNull()
  })

  it('un 404 avec code métier est une vraie erreur', async () => {
    getContext.mockRejectedValue({ statusCode: 404, data: { code: 'rating-not-found', detail: 'Avis introuvable' } })
    const c = useRatingContext()
    await c.load('rt1')
    expect(c.error.value).toBe('Avis introuvable')
  })
})
