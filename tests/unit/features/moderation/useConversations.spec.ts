import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/moderation/services/moderationService')
import { useConversations } from '@/features/moderation/composables/useConversations'
import { moderationService } from '@/features/moderation/services/moderationService'
const svc = moderationService as any

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.listConversations = vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
  })

  it('fetchConversations loads page', async () => {
    svc.listConversations.mockResolvedValue({ content: [{ id: 'c1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const c = useConversations()
    await c.fetchConversations()
    expect(c.conversations.value).toHaveLength(1)
  })

  it('setFlaggedOnly resets page', async () => {
    const c = useConversations()
    await c.goToPage(2)
    await c.setFlaggedOnly(true)
    expect(c.currentPage.value).toBe(0)
    expect(c.filters.flaggedOnly).toBe(true)
  })

  it('captures errors', async () => {
    svc.listConversations.mockRejectedValue(new Error('conv boom'))
    const c = useConversations()
    await c.fetchConversations()
    expect(c.error.value).toBe('conv boom')
  })
})
