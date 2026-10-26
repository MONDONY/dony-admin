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

  it('list() : « ouvertes » écarte les reportées, « reportées » les isole', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 })
    await alertsService.list({ type: null, severity: null, resolved: 'OPEN' }, 0, 100)
    await alertsService.list({ type: null, severity: null, resolved: 'SNOOZED' }, 0, 100)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ resolved: false, snoozed: false })
    expect(apiMock.mock.calls[1][1].query).toMatchObject({ resolved: false, snoozed: true })
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

  it('violations() GETs the live rows', async () => {
    apiMock.mockResolvedValue({ invariant: 'INV-01', total: 0, rows: [] })
    await alertsService.violations('a1')
    expect(apiMock).toHaveBeenCalledWith('/admin/alerts/a1/violations')
  })

  it('get() GETe une alerte par identifiant', async () => {
    apiMock.mockResolvedValue({ id: 'a1' })
    await alertsService.get('a1')
    expect(apiMock).toHaveBeenCalledWith('/admin/alerts/a1')
  })

  it('getContext() GETe le contexte', async () => {
    apiMock.mockResolvedValue({ related: [], history: [] })
    await alertsService.getContext('a1')
    expect(apiMock).toHaveBeenCalledWith('/admin/alerts/a1/context')
  })

  it('resolveBatch() POSTe les identifiants et la note', async () => {
    apiMock.mockResolvedValue({ resolved: ['a1'], alreadyResolved: [], notFound: [] })
    await alertsService.resolveBatch(['a1', 'a2'], 'Versement forcé')
    expect(apiMock).toHaveBeenCalledWith('/admin/alerts/resolve-batch', { method: 'POST', body: { ids: ['a1', 'a2'], note: 'Versement forcé' } })
  })

  it('reopen(), snooze() et unsnooze()', async () => {
    apiMock.mockResolvedValue({ id: 'a1' })
    await alertsService.reopen('a1', 'revenue')
    await alertsService.snooze('a1', 24, 'colis en route')
    await alertsService.unsnooze('a1')
    expect(apiMock.mock.calls).toEqual([
      ['/admin/alerts/a1/reopen', { method: 'POST', body: { note: 'revenue' } }],
      ['/admin/alerts/a1/snooze', { method: 'POST', body: { hours: 24, note: 'colis en route' } }],
      ['/admin/alerts/a1/snooze', { method: 'DELETE' }],
    ])
  })
})
