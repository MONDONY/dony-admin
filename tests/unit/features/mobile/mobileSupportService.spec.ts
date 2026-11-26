import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { mobileSupportService } from '@/features/mobile/services/mobileSupportService'

describe('mobileSupportService', () => {
  beforeEach(() => { apiMock.mockReset(); apiMock.mockResolvedValue({}) })

  it('list: every ticket (scope all), status only when filtered', async () => {
    await mobileSupportService.list('TOUS', 0, 100)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/support/tickets', { query: { scope: 'all', page: 0, size: 100 } })
    await mobileSupportService.list('RESOLVED', 2, 20)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/support/tickets', { query: { scope: 'all', page: 2, size: 20, status: 'RESOLVED' } })
  })

  it('get is a GET, reply POSTs text without attachment, assign POSTs; ids encoded', async () => {
    await mobileSupportService.get('t1')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/support/tickets/t1')
    await mobileSupportService.reply('../x', 'Bonjour')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/support/tickets/..%2Fx/messages', { method: 'POST', body: { content: 'Bonjour', attachmentKeys: [] } })
    await mobileSupportService.assign('t1')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/support/tickets/t1/assign', { method: 'POST' })
  })

  it('exposes exactly list, get, reply and assign', () => {
    expect(Object.keys(mobileSupportService).sort()).toEqual(['assign', 'get', 'list', 'reply'])
  })
})
