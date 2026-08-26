import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/moderation/services/moderationService')
import { useConversationThread } from '@/features/moderation/composables/useConversationThread'
import { moderationService } from '@/features/moderation/services/moderationService'
const svc = moderationService as any

describe('useConversationThread', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.getMessages = vi.fn().mockResolvedValue([])
    svc.deleteMessage = vi.fn().mockResolvedValue(undefined)
  })

  it('open loads messages for a conversation', async () => {
    svc.getMessages.mockResolvedValue([{ id: 'm1', content: 'hi' }])
    const t = useConversationThread()
    await t.open('c1')
    expect(t.activeId.value).toBe('c1')
    expect(t.messages.value).toHaveLength(1)
  })

  it('close clears state', async () => {
    const t = useConversationThread()
    await t.open('c1')
    t.close()
    expect(t.activeId.value).toBeNull()
    expect(t.messages.value).toHaveLength(0)
  })

  it('deleteMessage calls service then reloads the thread', async () => {
    svc.getMessages.mockResolvedValue([{ id: 'm1', content: 'hi' }])
    const t = useConversationThread()
    await t.open('c1')
    svc.getMessages.mockClear()
    await t.deleteMessage('m1')
    expect(svc.deleteMessage).toHaveBeenCalledWith('c1', 'm1')
    expect(svc.getMessages).toHaveBeenCalledWith('c1')
  })

  it('captures errors', async () => {
    svc.getMessages.mockRejectedValue(new Error('thread boom'))
    const t = useConversationThread()
    await t.open('c1')
    expect(t.error.value).toBe('thread boom')
  })

  it('deleteMessage() est un no-op quand activeId est null', async () => {
    const t = useConversationThread()
    // activeId.value = null par défaut → la garde empêche l'appel au service
    await t.deleteMessage('m99')
    expect(svc.deleteMessage).not.toHaveBeenCalled()
  })
})
