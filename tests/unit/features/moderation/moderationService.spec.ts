import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { moderationService } from '@/features/moderation/services/moderationService'

describe('moderationService', () => {
  beforeEach(() => apiMock.mockReset())

  it('listConversations omits flagged when false', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await moderationService.listConversations({ flaggedOnly: false }, 0, 20)
    const q = apiMock.mock.calls[0][1].query
    expect(q).toMatchObject({ page: 0, size: 20 })
    expect(q.flagged).toBeUndefined()
  })

  it('listConversations passes flagged when true', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await moderationService.listConversations({ flaggedOnly: true }, 1, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ flagged: true, page: 1, size: 20 })
    expect(apiMock.mock.calls[0][0]).toBe('/admin/conversations')
  })

  it('getMessages GETs the thread', async () => {
    apiMock.mockResolvedValue([])
    await moderationService.getMessages('c1')
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations/c1/messages')
  })

  it('deleteMessage DELETEs', async () => {
    apiMock.mockResolvedValue(undefined)
    await moderationService.deleteMessage('m1')
    expect(apiMock).toHaveBeenCalledWith('/admin/messages/m1', { method: 'DELETE' })
  })
})
