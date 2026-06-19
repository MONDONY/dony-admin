import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { alertsService } from '@/features/alerts/services/alertsService'

describe('alertsService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list() builds query, mapping OPEN→resolved=false', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await alertsService.list({ type: 'ESCROW_J48_TIMEOUT', severity: 'CRITICAL', resolved: 'OPEN' }, 0, 20)
    const [url, opts] = apiMock.mock.calls[0]
    expect(url).toBe('/admin/alerts')
    expect(opts.query).toMatchObject({ type: 'ESCROW_J48_TIMEOUT', severity: 'CRITICAL', resolved: false, page: 0, size: 20 })
  })

  it('list() omits resolved when ALL', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await alertsService.list({ type: null, severity: null, resolved: 'ALL' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.resolved).toBeUndefined()
  })

  it('resolve() POSTs note', async () => {
    apiMock.mockResolvedValue({ id: 'a1', resolved: true })
    await alertsService.resolve('a1', 'traité')
    expect(apiMock).toHaveBeenCalledWith('/admin/alerts/a1/resolve', { method: 'POST', body: { note: 'traité' } })
  })
})
