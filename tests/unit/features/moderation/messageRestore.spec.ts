import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { moderationService } from '@/features/moderation/services/moderationService'
import { useConversationThread } from '@/features/moderation/composables/useConversationThread'
import MessageThread from '@/features/moderation/components/MessageThread.vue'

const adminDeleted = {
  id: 'm3', conversationId: 'c1', senderName: 'Awa', content: 'propos déplacés', flagged: false,
  deleted: true, deletedAt: '2026-09-20T10:00:00Z', deletedByAdmin: true, createdAt: '2026-06-01T10:06:00Z',
}
const selfDeleted = { ...adminDeleted, id: 'm4', deletedByAdmin: false, deletedAt: undefined, content: '' }

describe('moderationService.restoreMessage', () => {
  beforeEach(() => apiMock.mockReset())
  it('POST /admin/conversations/{cid}/messages/{mid}/restore avec le motif', async () => {
    apiMock.mockResolvedValue({ id: 'm3' })
    await moderationService.restoreMessage('c1', 'm3', 'suppression abusive')
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations/c1/messages/m3/restore', {
      method: 'POST', body: { reason: 'suppression abusive' },
    })
  })
})

describe('useConversationThread : restauration', () => {
  beforeEach(() => apiMock.mockReset())

  function route(restore: () => unknown) {
    apiMock.mockImplementation((url: string, opts?: { method?: string }) => {
      if (opts?.method === 'POST') return restore()
      return Promise.resolve([adminDeleted])
    })
  }

  it('restaure, recharge et rend true', async () => {
    route(() => Promise.resolve({ id: 'm3' }))
    const t = useConversationThread()
    await t.open('c1')
    apiMock.mockClear()
    expect(await t.restoreMessage('m3', 'suppression abusive')).toBe(true)
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations/c1/messages')
  })

  it('sans conversation ouverte, ne fait rien', async () => {
    const t = useConversationThread()
    expect(await t.restoreMessage('m3', 'suppression abusive')).toBe(false)
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('404 sans code : le message est marqué indisponible, sans erreur', async () => {
    route(() => Promise.reject(Object.assign(new Error('404'), { statusCode: 404, data: {} })))
    const t = useConversationThread()
    await t.open('c1')
    expect(await t.restoreMessage('m3', 'suppression abusive')).toBe(false)
    expect(t.restoreUnavailableIds.value).toEqual(['m3'])
    expect(t.restoreError.value).toBeNull()
  })

  it('autre erreur : detail affiché', async () => {
    route(() => Promise.reject(Object.assign(new Error('409'), { statusCode: 409, data: { code: 'message-not-deleted', detail: 'Déjà visible.' } })))
    const t = useConversationThread()
    await t.open('c1')
    expect(await t.restoreMessage('m3', 'suppression abusive')).toBe(false)
    expect(t.restoreError.value).toBe('Déjà visible.')
    expect(t.restoreUnavailableIds.value).toEqual([])
  })

  it('close oublie les messages indisponibles et l’erreur', async () => {
    route(() => Promise.reject(Object.assign(new Error('405'), { statusCode: 405 })))
    const t = useConversationThread()
    await t.open('c1')
    await t.restoreMessage('m3', 'suppression abusive')
    t.close()
    expect(t.restoreUnavailableIds.value).toEqual([])
    expect(t.restoreError.value).toBeNull()
  })
})

describe('MessageThread : message supprimé par un admin', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('grisé « Supprimé par un admin le … » avec Restaurer', async () => {
    const w = mount(MessageThread, { props: { messages: [adminDeleted], loading: false } })
    const info = w.find('[data-test="msg-deleted-by-admin-m3"]')
    expect(info.text()).toContain('Supprimé par un admin le')
    expect(info.text()).toContain('20/09/2026')
    expect(w.find('[data-test="message-m3"]').text()).toContain('propos déplacés')
    await w.find('[data-test="restore-msg-m3"]').trigger('click')
    expect(w.emitted('restore')![0]).toEqual(['m3'])
  })

  it('restauration indisponible : bouton masqué, mention discrète', () => {
    const w = mount(MessageThread, { props: { messages: [adminDeleted], loading: false, restoreUnavailableIds: ['m3'] } })
    expect(w.find('[data-test="restore-msg-m3"]').exists()).toBe(false)
    expect(w.find('[data-test="msg-restore-unavailable-m3"]').text()).toBe('Restauration indisponible pour ce message')
  })

  it('supprimé par son auteur (ou ancien back) : pas de restauration', () => {
    const w = mount(MessageThread, { props: { messages: [selfDeleted], loading: false } })
    expect(w.find('[data-test="restore-msg-m4"]').exists()).toBe(false)
    expect(w.find('[data-test="msg-deleted-by-admin-m4"]').exists()).toBe(false)
    expect(w.find('[data-test="message-m4"]').text()).toContain('Message supprimé')
  })

  it('sans MESSAGE_DELETE, pas de bouton Restaurer', () => {
    seedAuth('ADMIN', { MESSAGE_DELETE: false })
    const w = mount(MessageThread, { props: { messages: [adminDeleted], loading: false } })
    expect(w.find('[data-test="msg-deleted-by-admin-m3"]').exists()).toBe(true)
    expect(w.find('[data-test="restore-msg-m3"]').exists()).toBe(false)
  })

  it('sans date de suppression, reste lisible', () => {
    const w = mount(MessageThread, { props: { messages: [{ ...adminDeleted, deletedAt: undefined }], loading: false } })
    expect(w.find('[data-test="msg-deleted-by-admin-m3"]').text()).toBe('Supprimé par un admin')
  })
})
