import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { supportService } from '@/features/support/services/supportService'

const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

describe('supportService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list passe le scope et omet le statut TOUS', async () => {
    apiMock.mockResolvedValue(emptyPage)
    await supportService.list('unassigned', 'TOUS', 0, 20)
    expect(apiMock.mock.calls[0][0]).toBe('/admin/support/tickets')
    const q = apiMock.mock.calls[0][1].query
    expect(q).toMatchObject({ scope: 'unassigned', page: 0, size: 20 })
    expect(q.status).toBeUndefined()
  })

  it('list passe un statut explicite', async () => {
    apiMock.mockResolvedValue(emptyPage)
    await supportService.list('mine', 'WAITING_SUPPORT', 2, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({
      scope: 'mine', status: 'WAITING_SUPPORT', page: 2, size: 20,
    })
  })

  it('get lit le détail', async () => {
    apiMock.mockResolvedValue({ id: 't1' })
    await supportService.get('t1')
    expect(apiMock).toHaveBeenCalledWith('/admin/support/tickets/t1')
  })

  it('assign POSTe sans corps', async () => {
    apiMock.mockResolvedValue({ id: 't1', status: 'ASSIGNED' })
    await supportService.assign('t1')
    expect(apiMock).toHaveBeenCalledWith('/admin/support/tickets/t1/assign', { method: 'POST' })
  })

  it('reassign POSTe l’adminId cible', async () => {
    apiMock.mockResolvedValue({ id: 't1' })
    await supportService.reassign('t1', 'admin-2')
    expect(apiMock).toHaveBeenCalledWith('/admin/support/tickets/t1/reassign', {
      method: 'POST', body: { adminId: 'admin-2' },
    })
  })

  it('reply POSTe le contenu et les cles', async () => {
    apiMock.mockResolvedValue({ id: 'm1' })
    await supportService.reply('t1', 'Bonjour', ['support/admin/u1/1.jpg'])
    expect(apiMock).toHaveBeenCalledWith('/admin/support/tickets/t1/messages', {
      method: 'POST', body: { content: 'Bonjour', attachmentKeys: ['support/admin/u1/1.jpg'] },
    })
  })

  it('reply accepte un contenu null (image seule)', async () => {
    apiMock.mockResolvedValue({ id: 'm1' })
    await supportService.reply('t1', null, ['support/admin/u1/1.jpg'])
    expect(apiMock).toHaveBeenCalledWith('/admin/support/tickets/t1/messages', {
      method: 'POST', body: { content: null, attachmentKeys: ['support/admin/u1/1.jpg'] },
    })
  })

  it('uploadAttachment envoie un FormData multipart', async () => {
    apiMock.mockResolvedValue({ key: 'support/admin/u1/1.jpg', url: 'https://signed/1' })
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await supportService.uploadAttachment(file)
    expect(result.key).toBe('support/admin/u1/1.jpg')
    const call = apiMock.mock.calls[0]
    expect(call[0]).toBe('/admin/support/tickets/attachments')
    expect(call[1].method).toBe('POST')
    expect(call[1].body).toBeInstanceOf(FormData)
    expect((call[1].body as FormData).get('file')).toBe(file)
  })

  it('resolve POSTe', async () => {
    apiMock.mockResolvedValue({ id: 't1', status: 'RESOLVED' })
    await supportService.resolve('t1')
    expect(apiMock).toHaveBeenCalledWith('/admin/support/tickets/t1/resolve', { method: 'POST' })
  })

  it('list transmet le filtre utilisateur quand il est fourni', async () => {
    apiMock.mockResolvedValue(emptyPage)
    await supportService.list('all', 'TOUS', 0, 20, 'user-1')
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ scope: 'all', userId: 'user-1' })
  })

  it('list omet userId sans filtre', async () => {
    apiMock.mockResolvedValue(emptyPage)
    await supportService.list('all', 'TOUS', 0, 20)
    expect(apiMock.mock.calls[0][1].query.userId).toBeUndefined()
  })

  it('startTicket POSTe la conversation initiée par l’admin', async () => {
    apiMock.mockResolvedValue({ id: 't9' })
    const payload = {
      userId: 'user-1', category: 'PAYMENT' as const, subject: 'Votre paiement',
      message: 'Bonjour, pouvez-vous nous confirmer…', attachmentKeys: ['support/admin/a1/1.jpg'],
    }
    const result = await supportService.startTicket(payload)
    expect(result).toEqual({ id: 't9' })
    expect(apiMock).toHaveBeenCalledWith('/admin/support/tickets', { method: 'POST', body: payload })
  })

  it('listByUser lit les tickets d’un utilisateur, tous périmètres confondus', async () => {
    apiMock.mockResolvedValue(emptyPage)
    await supportService.listByUser('user-1', 5)
    expect(apiMock).toHaveBeenCalledWith('/admin/support/tickets', {
      query: { scope: 'all', userId: 'user-1', page: 0, size: 5 },
    })
  })

  it('listByUser lit 5 tickets par défaut', async () => {
    apiMock.mockResolvedValue(emptyPage)
    await supportService.listByUser('user-1')
    expect(apiMock.mock.calls[0][1].query.size).toBe(5)
  })
})
