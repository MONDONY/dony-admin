import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { mobileAlertsService } from '@/features/mobile/services/mobileAlertsService'

describe('mobileAlertsService', () => {
  beforeEach(() => { apiMock.mockReset(); apiMock.mockResolvedValue({ content: [] }) })

  it('list: the same status filters as the desktop list (open, snoozed, resolved, all)', async () => {
    await mobileAlertsService.list('OPEN', 0, 100)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/alerts', { query: { page: 0, size: 100, resolved: false, snoozed: false } })
    await mobileAlertsService.list('SNOOZED', 0, 100)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/alerts', { query: { page: 0, size: 100, resolved: false, snoozed: true } })
    await mobileAlertsService.list('RESOLVED', 1, 50)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/alerts', { query: { page: 1, size: 50, resolved: true } })
    await mobileAlertsService.list('ALL', 0, 100)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/alerts', { query: { page: 0, size: 100 } })
  })

  it('get is a GET; claim POSTs and release DELETEs /admin/alerts/{id}/claim, the id encoded', async () => {
    await mobileAlertsService.get('a1')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/alerts/a1')
    await mobileAlertsService.claim('../x')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/alerts/..%2Fx/claim', { method: 'POST' })
    await mobileAlertsService.release('a1')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/alerts/a1/claim', { method: 'DELETE' })
  })

  it('exposes exactly list, get, claim and release', () => {
    expect(Object.keys(mobileAlertsService).sort()).toEqual(['claim', 'get', 'list', 'release'])
  })
})
