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
    await b.send('T', 'B', { type: 'ALL' }, false)
    expect(svc.send).toHaveBeenCalledWith('T', 'B', { type: 'ALL' }, false)
    expect(svc.listHistory).toHaveBeenCalled()
    expect(b.recipientCount.value).toBeNull()
  })

  it('send capture l erreur backend sans recharger l historique', async () => {
    svc.send.mockRejectedValue({ data: { detail: 'Envoi impossible' } })
    const b = useBroadcast()
    await b.send('T', 'B', { type: 'ALL' }, false)
    expect(b.error.value).toBe('Envoi impossible')
    expect(svc.listHistory).not.toHaveBeenCalled()
  })

  it('preview garde le détail push de l’audience', async () => {
    svc.preview.mockResolvedValue({ recipientCount: 42, pushReachableCount: 30 })
    const b = useBroadcast()
    await b.preview({ type: 'ALL' })
    expect(b.audience.value).toEqual({ recipientCount: 42, pushReachableCount: 30 })
  })

  it('apercu_debounce400_etIgnoreReponseObsolete : seule la dernière réponse compte', async () => {
    let resolveA!: ReturnType<typeof vi.fn>
    svc.preview
      .mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
      .mockResolvedValueOnce({ recipientCount: 2, pushReachableCount: 1 })
    const b = useBroadcast()
    const first = b.preview({ type: 'ALL' })
    await b.preview({ type: 'SENDERS' })
    expect(b.recipientCount.value).toBe(2)
    resolveA({ recipientCount: 99, pushReachableCount: 99 })
    await first
    expect(b.recipientCount.value).toBe(2)
    expect(b.previewing.value).toBe(false)
  })

  it('une erreur obsolète ne touche pas l’état courant', async () => {
    let rejectA!: ReturnType<typeof vi.fn>
    svc.preview
      .mockImplementationOnce(() => new Promise((_, r) => { rejectA = r }))
      .mockResolvedValueOnce({ recipientCount: 2, pushReachableCount: 1 })
    const b = useBroadcast()
    const first = b.preview({ type: 'ALL' })
    await b.preview({ type: 'SENDERS' })
    rejectA({ data: { detail: 'Vieille erreur' } })
    await first
    expect(b.error.value).toBeNull()
    expect(b.recipientCount.value).toBe(2)
  })

  it('send écarte aussi une réponse d’aperçu encore en vol', async () => {
    let resolveA!: ReturnType<typeof vi.fn>
    svc.preview.mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
    const b = useBroadcast()
    const p = b.preview({ type: 'ALL' })
    await b.send('T', 'B', { type: 'ALL' }, false)
    resolveA({ recipientCount: 7, pushReachableCount: 1 })
    await p
    expect(b.recipientCount.value).toBeNull()
  })

  it('fetchFields charge le catalogue ou garde l’erreur', async () => {
    svc.fields = vi.fn().mockResolvedValue([{ key: 'is_pro' }])
    const b = useBroadcast()
    await b.fetchFields()
    expect(b.fields.value).toHaveLength(1)
    svc.fields.mockRejectedValue({ data: { detail: 'Catalogue indisponible' } })
    await b.fetchFields()
    expect(b.error.value).toBe('Catalogue indisponible')
  })

  it('fetchFields ignore une réponse qui n’est pas un tableau', async () => {
    svc.fields = vi.fn().mockResolvedValue({ content: [] })
    const b = useBroadcast()
    await b.fetchFields()
    expect(b.fields.value).toEqual([])
  })

  it('goToPage change de page et recharge', async () => {
    const b = useBroadcast()
    await b.goToPage(2)
    expect(b.currentPage.value).toBe(2)
    expect(svc.listHistory).toHaveBeenCalledWith(2, 20)
  })
})
