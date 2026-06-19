import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { ratingsService } from '@/features/signalements/services/ratingsService'

describe('ratingsService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list omits flaggedOnly when false', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await ratingsService.list({ flaggedOnly: false }, 0, 20)
    const q = apiMock.mock.calls[0][1].query
    expect(q).toMatchObject({ page: 0, size: 20 })
    expect(q.flaggedOnly).toBeUndefined()
  })

  it('list passes flaggedOnly when true', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await ratingsService.list({ flaggedOnly: true }, 1, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ flaggedOnly: true, page: 1, size: 20 })
  })

  it('exclude POSTs excluded + reason', async () => {
    apiMock.mockResolvedValue({ id: 'rt1', excluded: true })
    await ratingsService.exclude('rt1', true, 'avis diffamatoire')
    expect(apiMock).toHaveBeenCalledWith('/admin/ratings/rt1/exclude', {
      method: 'POST',
      body: { excluded: true, reason: 'avis diffamatoire' },
    })
  })

  it('remove DELETEs', async () => {
    apiMock.mockResolvedValue(undefined)
    await ratingsService.remove('rt1')
    expect(apiMock).toHaveBeenCalledWith('/admin/ratings/rt1', { method: 'DELETE' })
  })
})
