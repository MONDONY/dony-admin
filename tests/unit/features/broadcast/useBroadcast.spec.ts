import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/broadcast/services/broadcastService')
import { useBroadcast } from '@/features/broadcast/composables/useBroadcast'
import { broadcastService } from '@/features/broadcast/services/broadcastService'

const svc = broadcastService as unknown as Record<string, ReturnType<typeof vi.fn>>
const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

describe('useBroadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.listHistory = vi.fn().mockResolvedValue(emptyPage)
    svc.preview = vi.fn().mockResolvedValue({ recipientCount: 0 })
    svc.send = vi.fn().mockResolvedValue({ id: 'b1', recipientCount: 5 })
  })

  it('fetchHistory charge la page courante', async () => {
    svc.listHistory.mockResolvedValue({ ...emptyPage, content: [{ id: 'b1' }], totalPages: 1, totalElements: 1 })
    const b = useBroadcast()
    await b.fetchHistory()
    expect(b.history.value).toHaveLength(1)
    expect(b.totalPages.value).toBe(1)
  })

  it('preview stocke le nombre de destinataires', async () => {
    svc.preview.mockResolvedValue({ recipientCount: 42 })
    const b = useBroadcast()
    await b.preview({ type: 'ALL' })
    expect(b.recipientCount.value).toBe(42)
  })

  it('preview remet le compteur a null en cas d erreur et affiche le detail RFC 7807', async () => {
    svc.preview.mockRejectedValue({ data: { detail: 'Ciblage invalide' } })
    const b = useBroadcast()
    await b.preview({ type: 'CORRIDOR', origin: 'Paris' })
    expect(b.recipientCount.value).toBeNull()
    expect(b.error.value).toBe('Ciblage invalide')
  })

  it('send recharge l historique et remet le compteur a zero', async () => {
    const b = useBroadcast()
    await b.preview({ type: 'ALL' })
    await b.send('T', 'B', { type: 'ALL' })
    expect(svc.send).toHaveBeenCalledWith('T', 'B', { type: 'ALL' })
    expect(svc.listHistory).toHaveBeenCalled()
    expect(b.recipientCount.value).toBeNull()
  })

  it('send capture l erreur backend sans recharger l historique', async () => {
    svc.send.mockRejectedValue({ data: { detail: 'Envoi impossible' } })
    const b = useBroadcast()
    await b.send('T', 'B', { type: 'ALL' })
    expect(b.error.value).toBe('Envoi impossible')
    expect(svc.listHistory).not.toHaveBeenCalled()
  })

  it('goToPage change de page et recharge', async () => {
    const b = useBroadcast()
    await b.goToPage(2)
    expect(b.currentPage.value).toBe(2)
    expect(svc.listHistory).toHaveBeenCalledWith(2, 20)
  })
})
