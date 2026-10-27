import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { moderationService } from '@/features/moderation/services/moderationService'

describe('moderationService', () => {
  beforeEach(() => apiMock.mockReset())

  it('listConversations lit une page, sans filtre par défaut', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 })
    await moderationService.listConversations(0, 100)
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations', { query: { page: 0, size: 100 } })
  })

  it('listConversations envoie flagged seulement s’il est vrai, et la recherche nettoyée', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await moderationService.listConversations(1, 50, { flagged: true, q: '  Aicha ' })
    expect(apiMock).toHaveBeenLastCalledWith('/admin/conversations', { query: { page: 1, size: 50, flagged: true, q: 'Aicha' } })
    await moderationService.listConversations(0, 50, { flagged: false, q: '   ' })
    expect(apiMock).toHaveBeenLastCalledWith('/admin/conversations', { query: { page: 0, size: 50 } })
  })

  it('getContext : GET …/context, identifiant encodé', async () => {
    apiMock.mockResolvedValue({ history: [], notes: [] })
    await moderationService.getContext('../x')
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations/..%2Fx/context')
  })

  it('addNote : POST …/notes avec le texte', async () => {
    apiMock.mockResolvedValue({ id: 'n1' })
    await moderationService.addNote('c/1', 'Une note')
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations/c%2F1/notes', { method: 'POST', body: { content: 'Une note' } })
  })

  it('encode les identifiants : pas de traversée de chemin', async () => {
    apiMock.mockResolvedValue([])
    await moderationService.getMessages('../../admin/x')
    expect(apiMock.mock.calls[0][0]).toBe('/admin/conversations/..%2F..%2Fadmin%2Fx/messages')
    await moderationService.deleteMessage('c/1', 'm/2')
    expect(apiMock.mock.calls[1][0]).toBe('/admin/conversations/c%2F1/messages/m%2F2')
  })

  it('getMessages GETs the thread', async () => {
    apiMock.mockResolvedValue([])
    await moderationService.getMessages('c1')
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations/c1/messages')
  })

  it('deleteMessage DELETEs', async () => {
    apiMock.mockResolvedValue(undefined)
    await moderationService.deleteMessage('c1', 'm1')
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations/c1/messages/m1', { method: 'DELETE' })
  })

  it('deleteMessage envoie le motif en paramètre de requête', async () => {
    apiMock.mockResolvedValue(undefined)
    await moderationService.deleteMessage('c1', 'm1', '  propos haineux  ')
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations/c1/messages/m1', { method: 'DELETE', query: { reason: 'propos haineux' } })
  })

  it('deleteMessage omet un motif vide', async () => {
    apiMock.mockResolvedValue(undefined)
    await moderationService.deleteMessage('c1', 'm1', '   ')
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations/c1/messages/m1', { method: 'DELETE' })
  })
})
