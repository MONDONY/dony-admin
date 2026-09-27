import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { packageRequestsService } from '@/features/package-requests/services/packageRequestsService'
import type { PackageRequestFilters } from '@/features/package-requests/types/index'

const EMPTY_PAGE = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
const noFilter: PackageRequestFilters = { status: 'ALL', query: '', reportedOnly: false, from: null, to: null }

describe('packageRequestsService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list sans filtre n’envoie que la pagination', async () => {
    apiMock.mockResolvedValue(EMPTY_PAGE)
    await packageRequestsService.list(noFilter, 0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/package-requests', { query: { page: 0, size: 20 } })
  })

  it('list transmet statut, recherche nettoyée, signalées seulement et période', async () => {
    apiMock.mockResolvedValue(EMPTY_PAGE)
    await packageRequestsService.list(
      { status: 'REMOVED_BY_ADMIN', query: '  Dakar ', reportedOnly: true, from: '2026-09-01', to: '2026-09-30' }, 2, 20,
    )
    expect(apiMock).toHaveBeenCalledWith('/admin/package-requests', {
      query: { page: 2, size: 20, status: 'REMOVED_BY_ADMIN', query: 'Dakar', reportedOnly: true, from: '2026-09-01', to: '2026-09-30' },
    })
  })

  it('list omet une recherche faite d’espaces', async () => {
    apiMock.mockResolvedValue(EMPTY_PAGE)
    await packageRequestsService.list({ ...noFilter, query: '   ' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.query).toBeUndefined()
  })

  it('get lit le détail', async () => {
    apiMock.mockResolvedValue({ id: 'pr1' })
    await packageRequestsService.get('pr1')
    expect(apiMock).toHaveBeenCalledWith('/admin/package-requests/pr1')
  })

  it('remove POST le motif public et la note interne, séparément', async () => {
    apiMock.mockResolvedValue({ id: 'pr1', status: 'REMOVED_BY_ADMIN' })
    const r = await packageRequestsService.remove('pr1', 'SUSPECTED_FRAUD', 'ticket #12')
    expect(apiMock).toHaveBeenCalledWith('/admin/package-requests/pr1/remove', {
      method: 'POST', body: { publicReason: 'SUSPECTED_FRAUD', internalNote: 'ticket #12' },
    })
    expect(r.status).toBe('REMOVED_BY_ADMIN')
  })

  it('restore POST sans corps et rend le détail', async () => {
    apiMock.mockResolvedValue({ id: 'pr1', status: 'OPEN' })
    const r = await packageRequestsService.restore('pr1')
    expect(apiMock).toHaveBeenCalledWith('/admin/package-requests/pr1/restore', { method: 'POST' })
    expect(r.status).toBe('OPEN')
  })
})
