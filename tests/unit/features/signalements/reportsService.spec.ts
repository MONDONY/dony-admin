import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { reportsService } from '@/features/signalements/services/reportsService'

describe('reportsService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list omits status when ALL and targetType when null', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await reportsService.list({ status: 'ALL', targetType: null }, 0, 20)
    const q = apiMock.mock.calls[0][1].query
    expect(q).toMatchObject({ page: 0, size: 20 })
    expect(q.status).toBeUndefined()
    expect(q.targetType).toBeUndefined()
  })

  it('list passes status + targetType', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await reportsService.list({ status: 'OPEN', targetType: 'USER' }, 2, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ status: 'OPEN', targetType: 'USER', page: 2, size: 20 })
  })

  it('resolve POSTs action + note', async () => {
    apiMock.mockResolvedValue({ id: 'r1', status: 'RESOLVED' })
    await reportsService.resolve('r1', 'SUSPEND_TARGET', 'compte frauduleux')
    expect(apiMock).toHaveBeenCalledWith('/admin/reports/r1/resolve', {
      method: 'POST',
      body: { action: 'SUSPEND_TARGET', note: 'compte frauduleux' },
    })
  })

  it('list passe q nettoyé et l’omet quand vide', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await reportsService.list({ status: 'OPEN', targetType: null, q: '  badge ' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ q: 'badge' })
    apiMock.mockClear()
    await reportsService.list({ status: 'OPEN', targetType: null, q: '   ' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.q).toBeUndefined()
  })

  it('remove DELETE /admin/reports/{id}', async () => {
    apiMock.mockResolvedValue(undefined)
    await reportsService.remove('r1')
    expect(apiMock).toHaveBeenCalledWith('/admin/reports/r1', { method: 'DELETE' })
  })

  it('bulkDelete par identifiants', async () => {
    apiMock.mockResolvedValue({ deleted: 2 })
    const res = await reportsService.bulkDelete({ ids: ['a', 'b'] })
    expect(res).toEqual({ deleted: 2 })
    expect(apiMock).toHaveBeenCalledWith('/admin/reports/bulk-delete', { method: 'POST', body: { ids: ['a', 'b'] } })
  })

  it('bulkDelete « tous les résultats » envoie le filtre courant (ALL → pas de statut)', async () => {
    apiMock.mockResolvedValue({ deleted: 45 })
    await reportsService.bulkDelete({ all: true, filters: { status: 'ALL', targetType: 'APP', q: ' bug ' } })
    expect(apiMock).toHaveBeenCalledWith('/admin/reports/bulk-delete', {
      method: 'POST',
      body: { all: true, status: undefined, targetType: 'APP', q: 'bug' },
    })
  })
})
