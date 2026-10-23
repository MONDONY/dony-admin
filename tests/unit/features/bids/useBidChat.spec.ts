import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/moderation/services/moderationService')
import { useBidChat } from '@/features/bids/composables/useBidChat'
import { moderationService } from '@/features/moderation/services/moderationService'
import type { AdminMessage } from '@/features/moderation/types/index'
const svc = moderationService as any

const msg = (id: string): AdminMessage => ({ id, conversationId: 'c1', senderName: 'Awa', content: id, flagged: false, deleted: false, createdAt: '2026-10-06T18:53:35Z' })
const deferred = <T>() => Promise.withResolvers<T>()

describe('useBidChat', () => {
  beforeEach(() => { vi.clearAllMocks(); svc.getMessages = vi.fn() })

  it('useBidChat_loadsOnce', async () => {
    svc.getMessages.mockResolvedValue([msg('a'), msg('b')])
    const c = useBidChat('c1')
    expect(svc.getMessages).not.toHaveBeenCalled()
    await Promise.all([c.load(), c.load()])
    await c.load()
    expect(svc.getMessages).toHaveBeenCalledTimes(1)
    expect(svc.getMessages).toHaveBeenCalledWith('c1')
    expect(c.messages.value.map(m => m.id)).toEqual(['a', 'b'])
    await c.reload()
    expect(svc.getMessages).toHaveBeenCalledTimes(2)
  })

  it('useBidChat_staleResponseIgnored', async () => {
    const first = deferred<AdminMessage[]>()
    svc.getMessages.mockReturnValueOnce(first.promise).mockResolvedValueOnce([msg('new')])
    const c = useBidChat('c1')
    const p1 = c.load()
    const p2 = c.reload()
    await p2
    first.resolve([msg('old')])
    await p1
    expect(c.messages.value.map(m => m.id)).toEqual(['new'])
    expect(c.isLoading.value).toBe(false)
  })

  it('useBidChat_error', async () => {
    svc.getMessages.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500, data: {} }))
    const c = useBidChat('c1')
    await c.load()
    expect(c.error.value).toBeTruthy()
    expect(c.isLoading.value).toBe(false)
    svc.getMessages.mockResolvedValueOnce([msg('a')])
    await c.load()
    expect(c.error.value).toBeNull()
    expect(c.messages.value).toHaveLength(1)
  })

  it('useBidChat_conversationChange_resets', async () => {
    svc.getMessages.mockResolvedValueOnce([msg('a')]).mockResolvedValueOnce([msg('z')])
    let id = 'c1'
    const c = useBidChat(() => id)
    await c.load()
    id = 'c2'
    const p = c.load()
    expect(c.messages.value).toEqual([])
    await p
    expect(svc.getMessages).toHaveBeenLastCalledWith('c2')
    expect(c.messages.value.map(m => m.id)).toEqual(['z'])
  })
})
