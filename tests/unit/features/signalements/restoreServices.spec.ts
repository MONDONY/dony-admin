import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { reportsService } from '@/features/signalements/services/reportsService'
import { ratingsService } from '@/features/signalements/services/ratingsService'

const empty = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

describe('reportsService : éléments supprimés', () => {
  beforeEach(() => apiMock.mockReset())

  it('list envoie deleted=true et omet alors le statut', async () => {
    apiMock.mockResolvedValue(empty)
    await reportsService.list({ status: 'OPEN', targetType: 'USER', q: '', deleted: true }, 0, 20)
    const q = apiMock.mock.calls[0][1].query
    expect(q).toMatchObject({ deleted: true, targetType: 'USER', page: 0, size: 20 })
    expect(q.status).toBeUndefined()
  })

  it('list n’envoie pas deleted quand le filtre est coupé', async () => {
    apiMock.mockResolvedValue(empty)
    await reportsService.list({ status: 'OPEN', targetType: null, deleted: false }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.deleted).toBeUndefined()
  })

  it('restore POST /admin/reports/{id}/restore avec le motif', async () => {
    apiMock.mockResolvedValue({ id: 'r1' })
    await reportsService.restore('r1', 'supprimé par erreur')
    expect(apiMock).toHaveBeenCalledWith('/admin/reports/r1/restore', { method: 'POST', body: { reason: 'supprimé par erreur' } })
  })

  it('bulkRestore POST /admin/reports/bulk-restore et rend restored/skipped', async () => {
    apiMock.mockResolvedValue({ restored: 2, skipped: 1 })
    const res = await reportsService.bulkRestore(['a', 'b', 'c'])
    expect(res).toEqual({ restored: 2, skipped: 1 })
    expect(apiMock).toHaveBeenCalledWith('/admin/reports/bulk-restore', { method: 'POST', body: { ids: ['a', 'b', 'c'] } })
  })
})

describe('ratingsService : avis supprimés', () => {
  beforeEach(() => apiMock.mockReset())

  it('list envoie deleted=true', async () => {
    apiMock.mockResolvedValue(empty)
    await ratingsService.list({ flaggedOnly: false, deleted: true }, 1, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ deleted: true, page: 1, size: 20 })
  })

  it('list n’envoie pas deleted par défaut', async () => {
    apiMock.mockResolvedValue(empty)
    await ratingsService.list({ flaggedOnly: true }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.deleted).toBeUndefined()
  })

  it('restore POST /admin/ratings/{id}/restore avec le motif', async () => {
    apiMock.mockResolvedValue({ id: 'rt1' })
    await ratingsService.restore('rt1', 'avis légitime finalement')
    expect(apiMock).toHaveBeenCalledWith('/admin/ratings/rt1/restore', { method: 'POST', body: { reason: 'avis légitime finalement' } })
  })
})
