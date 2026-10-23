import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/bids/services/bidsAdminService')
import { ref } from 'vue'
import { useBidPhotos } from '@/features/bids/composables/useBidPhotos'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminBidPhoto, AdminBidPhotos } from '@/features/bids/types/index'
const svc = bidsAdminService as any

const photo = (id: string): AdminBidPhoto => ({ id, stage: 'DEPART', label: 'Remise du colis', at: '2026-06-01T10:00:00Z', url: `https://r2/${id}.jpg` })
const res = (...ids: string[]): AdminBidPhotos => ({ bidId: 'b1', photos: ids.map(photo) })

describe('useBidPhotos', () => {
  beforeEach(() => { vi.clearAllMocks(); svc.photos = vi.fn() })

  it('load_once', async () => {
    svc.photos.mockResolvedValue(res('a', 'b'))
    const p = useBidPhotos('b1')
    await Promise.all([p.load(), p.load()])
    await p.load()
    expect(svc.photos).toHaveBeenCalledTimes(1)
    expect(svc.photos).toHaveBeenCalledWith('b1')
    expect(p.photos.value.map(x => x.id)).toEqual(['a', 'b'])
    expect(p.isLoading.value).toBe(false)
    expect(p.error.value).toBeNull()
    expect(p.unavailable.value).toBe(false)
  })

  it('reload_forces', async () => {
    svc.photos.mockResolvedValueOnce(res('a')).mockResolvedValueOnce(res('a', 'c'))
    const p = useBidPhotos('b1')
    await p.load(); await p.reload()
    expect(svc.photos).toHaveBeenCalledTimes(2)
    expect(p.photos.value.map(x => x.id)).toEqual(['a', 'c'])
  })

  it('missingEndpoint_unavailable', async () => {
    svc.photos.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404, data: {} }))
    const p = useBidPhotos('b1'); await p.load()
    expect(p.unavailable.value).toBe(true)
    expect(p.error.value).toBeNull()
    expect(p.photos.value).toEqual([])
    await p.load()
    expect(svc.photos).toHaveBeenCalledTimes(1)
  })

  it('autre erreur : message lisible, nouvel essai possible', async () => {
    svc.photos.mockRejectedValueOnce(Object.assign(new Error('500'), { statusCode: 500, data: { detail: 'Panne' } }))
    svc.photos.mockResolvedValueOnce(res('a'))
    const p = useBidPhotos('b1'); await p.load()
    expect(p.error.value).toBe('Panne')
    expect(p.unavailable.value).toBe(false)
    await p.load()
    expect(svc.photos).toHaveBeenCalledTimes(2)
    expect(p.error.value).toBeNull()
    expect(p.photos.value).toHaveLength(1)
  })

  it('staleResponseIgnored', async () => {
    let resolveFirst!: (_v: unknown) => void
    svc.photos.mockReturnValueOnce(new Promise(r => { resolveFirst = r }))
    svc.photos.mockResolvedValueOnce(res('new'))
    const p = useBidPhotos('b1')
    const first = p.load(); const second = p.reload()
    await second; resolveFirst(res('old')); await first
    expect(p.photos.value.map(x => x.id)).toEqual(['new'])
    expect(p.isLoading.value).toBe(false)
  })

  it('erreur périmée ignorée', async () => {
    let rejectFirst!: (_e: unknown) => void
    svc.photos.mockReturnValueOnce(new Promise((_, r) => { rejectFirst = r }))
    svc.photos.mockResolvedValueOnce(res('new'))
    const p = useBidPhotos('b1')
    const first = p.load(); await p.reload()
    rejectFirst(new Error('ko')); await first
    expect(p.error.value).toBeNull()
    expect(p.photos.value).toHaveLength(1)
  })

  it('autre colis : recharge', async () => {
    svc.photos.mockResolvedValue(res('a'))
    const id = ref('b1')
    const p = useBidPhotos(id); await p.load()
    id.value = 'b2'; await p.load()
    expect(svc.photos).toHaveBeenLastCalledWith('b2')
    expect(svc.photos).toHaveBeenCalledTimes(2)
  })
})
