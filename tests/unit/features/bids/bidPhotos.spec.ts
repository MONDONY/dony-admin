import { describe, it, expect } from 'vitest'
import { PHOTO_STAGE_LABELS, fallbackPhotos, groupPhotos, safePhotos } from '@/features/bids/lib/bidPhotos'
import type { AdminBidDetail, AdminBidPhoto, AdminBidTimeline, PhotoStage } from '@/features/bids/types'

const photo = (id: string, stage: PhotoStage, url = `https://r2/${id}.jpg`): AdminBidPhoto => ({ id, stage, label: stage, at: '2026-06-01T10:00:00Z', url })

describe('bidPhotos', () => {
  it('libellés des étapes', () => {
    expect(PHOTO_STAGE_LABELS).toEqual({
      CREATION: 'Photos du colis', DEPART: 'Remise du colis', TRANSIT: 'En transit',
      ARRIVEE: 'Livraison', REFUSAL: 'Refus du colis', DISPUTE: 'Preuves du litige',
    })
  })

  it('groupPhotos_alwaysFourStages', () => {
    const g = groupPhotos([])
    expect(g.map(s => s.stage)).toEqual(['CREATION', 'DEPART', 'TRANSIT', 'ARRIVEE'])
    expect(g.every(s => s.photos.length === 0)).toBe(true)
    expect(g[0].label).toBe('Photos du colis')
  })

  it('groupPhotos_refusalOnlyIfPresent', () => {
    expect(groupPhotos([photo('a', 'CREATION')]).map(s => s.stage)).not.toContain('REFUSAL')
    const g = groupPhotos([photo('r', 'REFUSAL'), photo('d', 'DISPUTE')])
    expect(g.map(s => s.stage)).toEqual(['CREATION', 'DEPART', 'TRANSIT', 'ARRIVEE', 'REFUSAL', 'DISPUTE'])
    expect(g[4].photos).toHaveLength(1)
  })

  it('groupPhotos_keepsOrderWithinStage', () => {
    const g = groupPhotos([photo('b', 'TRANSIT'), photo('a', 'DEPART'), photo('c', 'TRANSIT')])
    expect(g[2].photos.map(p => p.id)).toEqual(['b', 'c'])
    expect(g[1].photos.map(p => p.id)).toEqual(['a'])
  })

  it('safePhotos_dropsHttpAndJavascript', () => {
    const out = safePhotos([
      photo('a', 'DEPART'), photo('b', 'DEPART', 'http://x/y.jpg'),
      photo('c', 'DEPART', 'javascript:alert(1)'), photo('d', 'DEPART', 'data:image/png;base64,AA'),
    ])
    expect(out.map(p => p.id)).toEqual(['a'])
  })

  it('fallbackPhotos_mapsLegacyFields', () => {
    const bid = { id: 'b1', photoUrls: ['https://r2/1.jpg', 'http://bad/2.jpg'] } as unknown as AdminBidDetail
    const timeline: AdminBidTimeline = {
      bidId: 'b1',
      entries: [
        { at: '2026-06-01T10:00:00', kind: 'SCAN', label: 'DEPART', photoUrl: 'https://r2/d.jpg', detail: 'Paris' },
        { at: '2026-06-02T10:00:00', kind: 'SCAN', label: 'TRANSIT', photoUrl: 'https://r2/t.jpg' },
        { at: '2026-06-03T10:00:00', kind: 'SCAN', label: 'ARRIVEE', photoUrl: 'https://r2/a.jpg' },
        { at: '2026-06-03T11:00:00', kind: 'SCAN', label: 'ARRIVEE', photoUrl: null },
        { at: '2026-06-03T12:00:00', kind: 'PHOTO', label: 'ARRIVEE', photoUrl: 'https://r2/x.jpg' },
        { at: '2026-06-03T13:00:00', kind: 'SCAN', label: 'AUTRE', photoUrl: 'https://r2/z.jpg' },
      ],
    }
    const out = fallbackPhotos(bid, timeline)
    expect(out.map(p => [p.stage, p.url])).toEqual([
      ['CREATION', 'https://r2/1.jpg'], ['CREATION', 'http://bad/2.jpg'],
      ['DEPART', 'https://r2/d.jpg'], ['TRANSIT', 'https://r2/t.jpg'], ['ARRIVEE', 'https://r2/a.jpg'],
    ])
    expect(new Set(out.map(p => p.id)).size).toBe(out.length)
    expect(out[2]).toMatchObject({ at: '2026-06-01T10:00:00', label: 'Remise du colis' })
  })

  it('fallbackPhotos : sans photoUrls ni chronologie', () => {
    expect(fallbackPhotos({ id: 'b' } as unknown as AdminBidDetail, null)).toEqual([])
  })
})
