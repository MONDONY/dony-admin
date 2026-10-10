import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/bids/services/bidsAdminService')
import { useBidTimeline } from '@/features/bids/composables/useBidTimeline'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
const svc = bidsAdminService as any

describe('useBidTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.getBid = vi.fn()
    svc.getTimeline = vi.fn()
  })
  it('open loads bid + timeline', async () => {
    svc.getBid.mockResolvedValue({ id: 'b1', status: 'COMPLETED' })
    svc.getTimeline.mockResolvedValue({ bidId: 'b1', entries: [{ at: '2026-06-01', kind: 'SCAN', label: 'Départ' }] })
    const t = useBidTimeline(); await t.open('b1')
    expect(t.bid.value?.id).toBe('b1')
    expect(t.timeline.value?.entries).toHaveLength(1)
  })
  it('close clears', async () => {
    svc.getBid.mockResolvedValue({ id: 'b1' }); svc.getTimeline.mockResolvedValue({ bidId: 'b1', entries: [] })
    const t = useBidTimeline(); await t.open('b1'); t.close()
    expect(t.bid.value).toBeNull()
  })
  it('captures errors', async () => {
    svc.getBid.mockRejectedValue(new Error('e'))
    const t = useBidTimeline(); await t.open('b1')
    expect(t.error.value).toBe('e')
  })

  it('affiche le detail du ProblemDetail plutôt que le message technique', async () => {
    svc.getBid.mockRejectedValue(Object.assign(new Error('500 Internal Server Error'), { data: { detail: 'Détail lisible du back' } }))
    const t = useBidTimeline(); await t.open('b1')
    expect(t.error.value).toBe('Détail lisible du back')
  })
})

describe('useBidTimeline — chargements indépendants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.getBid = vi.fn()
    svc.getTimeline = vi.fn()
  })
  it('chronologie en échec : la fiche reste lisible', async () => {
    svc.getBid.mockResolvedValue({ id: 'b1' })
    svc.getTimeline.mockRejectedValue(new Error('timeline ko'))
    const t = useBidTimeline(); await t.open('b1')
    expect(t.bid.value?.id).toBe('b1')
    expect(t.timelineError.value).toBe('timeline ko')
    expect(t.error.value).toBeNull()
  })
  it('réponse arrivée après fermeture : ignorée', async () => {
    let resolveBid!: (_v: unknown) => void
    let rejectTl!: (_e: unknown) => void
    svc.getBid.mockReturnValue(new Promise((r) => { resolveBid = r }))
    svc.getTimeline.mockReturnValue(new Promise((_, r) => { rejectTl = r }))
    const t = useBidTimeline()
    const p = t.open('b1')
    t.close()
    resolveBid({ id: 'b1' }); rejectTl(new Error('x'))
    await p
    expect(t.bid.value).toBeNull()
    expect(t.timelineError.value).toBeNull()
  })
  it('échec du colis après fermeture : pas d’erreur affichée', async () => {
    svc.getBid.mockRejectedValue(new Error('ko'))
    svc.getTimeline.mockResolvedValue({ bidId: 'b1', entries: [] })
    const t = useBidTimeline()
    const p = t.open('b1'); t.close(); await p
    expect(t.error.value).toBeNull()
    expect(t.timeline.value).toBeNull()
  })
  it('reload relit le colis ouvert, rien sans colis ouvert', async () => {
    svc.getBid.mockResolvedValue({ id: 'b1' })
    svc.getTimeline.mockResolvedValue({ bidId: 'b1', entries: [] })
    const t = useBidTimeline()
    await t.reload()
    expect(svc.getBid).not.toHaveBeenCalled()
    await t.open('b1'); await t.reload()
    expect(svc.getBid).toHaveBeenCalledTimes(2)
    expect(svc.getTimeline).toHaveBeenCalledTimes(2)
  })
})
