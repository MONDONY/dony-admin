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
    expect(await t.deleteMessage('m1', 'propos haineux')).toBe(true)
    expect(svc.deleteMessage).toHaveBeenCalledWith('c1', 'm1', 'propos haineux')
    expect(svc.getMessages).toHaveBeenCalledWith('c1')
  })

  it('deleteMessage en échec : phrase du back, rien n’est relu', async () => {
    svc.deleteMessage.mockRejectedValue(Object.assign(new Error('500'), { data: { detail: 'Firestore indisponible' } }))
    const t = useConversationThread()
    await t.open('c1')
    svc.getMessages.mockClear()
    expect(await t.deleteMessage('m1')).toBe(false)
    expect(t.deleteError.value).toBe('Firestore indisponible')
    expect(svc.getMessages).not.toHaveBeenCalled()
  })

  it('open efface le fil précédent et ses erreurs', async () => {
    svc.deleteMessage.mockRejectedValue(new Error('boom'))
    const t = useConversationThread()
    await t.open('c1')
    await t.deleteMessage('m1')
    svc.getMessages.mockResolvedValue([])
    await t.open('c2')
    expect(t.deleteError.value).toBeNull()
    expect(t.messages.value).toEqual([])
  })

  it('une lecture lente d’une conversation précédente ne remplace pas la conversation ouverte', async () => {
    // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction
    let releaseFirst: (v: unknown) => void = () => {}
    svc.getMessages
      .mockImplementationOnce(() => new Promise((r) => { releaseFirst = r }))
      .mockResolvedValueOnce([{ id: 'second' }])
    const t = useConversationThread()
    const first = t.open('c1')
    await t.open('c2')
    releaseFirst([{ id: 'first' }])
    await first
    expect(t.activeId.value).toBe('c2')
    expect(t.messages.value).toEqual([{ id: 'second' }])
  })

  it('close annule la lecture en cours', async () => {
    // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction
    let release: (v: unknown) => void = () => {}
    svc.getMessages.mockImplementationOnce(() => new Promise((r) => { release = r }))
    const t = useConversationThread()
    const pending = t.open('c1')
    t.close()
    release([{ id: 'late' }])
    await pending
    expect(t.messages.value).toEqual([])
    expect(t.isLoading.value).toBe(false)
  })

  it('captures errors', async () => {
    svc.getMessages.mockRejectedValue(new Error('thread boom'))
    const t = useConversationThread()
    await t.open('c1')
    expect(t.error.value).toBe('thread boom')
  })

  it('affiche le detail du ProblemDetail plutôt que le message technique', async () => {
    svc.getMessages.mockRejectedValue(Object.assign(new Error('500 Internal Server Error'), { data: { detail: 'Détail lisible du back' } }))
    const t = useConversationThread()
    await t.open('c1')
    expect(t.error.value).toBe('Détail lisible du back')
  })

  it('deleteMessage() est un no-op quand activeId est null', async () => {
    const t = useConversationThread()
    // activeId.value = null par défaut → la garde empêche l'appel au service
    await t.deleteMessage('m99')
    expect(svc.deleteMessage).not.toHaveBeenCalled()
  })
})
