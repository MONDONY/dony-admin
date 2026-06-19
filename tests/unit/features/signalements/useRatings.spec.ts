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
    await r.remove('rt1')
    expect(svc.remove).toHaveBeenCalledWith('rt1')
    expect(svc.list).toHaveBeenCalled()
  })

  it('captures errors', async () => {
    svc.list.mockRejectedValue(new Error('nope'))
    const r = useRatings()
    await r.fetchRatings()
    expect(r.error.value).toBe('nope')
  })
})
