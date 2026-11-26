import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { mobileMessagesService } from '@/features/mobile/services/mobileMessagesService'

describe('mobileMessagesService', () => {
  beforeEach(() => apiMock.mockReset())

  it('listConversations: page and size only by default', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await mobileMessagesService.listConversations(0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations', { query: { page: 0, size: 20 } })
  })

  it('listConversations: flagged only when true, q trimmed and dropped when empty', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await mobileMessagesService.listConversations(2, 20, { flagged: true, q: '  Aicha ' })
    expect(apiMock).toHaveBeenLastCalledWith('/admin/conversations', { query: { page: 2, size: 20, flagged: true, q: 'Aicha' } })
    await mobileMessagesService.listConversations(0, 20, { flagged: false, q: '   ' })
    expect(apiMock).toHaveBeenLastCalledWith('/admin/conversations', { query: { page: 0, size: 20 } })
  })

  it('getMessages and getContext: exact GET urls with the id encoded', async () => {
    apiMock.mockResolvedValue([])
    await mobileMessagesService.getMessages('../x')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/conversations/..%2Fx/messages')
    await mobileMessagesService.getContext('abc')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/conversations/abc/context')
  })

  it('exposes only the three read calls', () => {
    expect(Object.keys(mobileMessagesService).sort()).toEqual(['getContext', 'getMessages', 'listConversations'])
  })
})
