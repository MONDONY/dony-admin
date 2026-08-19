import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { broadcastService } from '@/features/broadcast/services/broadcastService'

describe('broadcastService', () => {
  beforeEach(() => apiMock.mockReset())

  it('preview POSTe le ciblage et ne renvoie que le compteur', async () => {
    apiMock.mockResolvedValue({ recipientCount: 128 })
    const res = await broadcastService.preview({ type: 'CORRIDOR', origin: 'Paris', destination: 'Dakar' })
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast/preview', {
      method: 'POST',
      body: { type: 'CORRIDOR', origin: 'Paris', destination: 'Dakar' },
    })
    expect(res.recipientCount).toBe(128)
  })

  it('preview omet les villes pour un ciblage non-corridor', async () => {
    apiMock.mockResolvedValue({ recipientCount: 3 })
    await broadcastService.preview({ type: 'ALL' })
    expect(apiMock.mock.calls[0][1].body).toEqual({ type: 'ALL' })
  })

  it('send POSTe titre, corps et ciblage', async () => {
    apiMock.mockResolvedValue({ id: 'b1', recipientCount: 12 })
    await broadcastService.send('Titre', 'Corps', { type: 'USER', userId: 'u1' })
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast', {
      method: 'POST',
      body: { title: 'Titre', body: 'Corps', target: { type: 'USER', userId: 'u1' } },
    })
  })

  it('listHistory GETe une page', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await broadcastService.listHistory(1, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcasts', { query: { page: 1, size: 20 } })
  })
})
