import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
const svc = vi.hoisted(() => ({ photos: vi.fn() }))
vi.mock('@/features/bids/services/bidsAdminService', () => ({ bidsAdminService: svc }))
import BidTrackingTab from '@/features/bids/components/BidTrackingTab.vue'
import type { AdminBidDetail, AdminBidTimeline } from '@/features/bids/types/index'

const bid = { id: 'b1', status: 'IN_TRANSIT', createdAt: '2026-05-30T08:00:00', photoUrls: ['https://r2/old.jpg'] } as unknown as AdminBidDetail
const timeline: AdminBidTimeline = { bidId: 'b1', entries: [
  { at: '2026-06-01T10:00:00', kind: 'SCAN', label: 'DEPART', photoUrl: 'https://r2/scan.jpg', source: 'TRACKING' },
] }
const mountTab = (props: Record<string, unknown> = {}) =>
  mount(BidTrackingTab, { props: { bid, timeline, ...props }, attachTo: document.body })
const missing = () => Object.assign(new Error('nf'), { statusCode: 404, data: {} })

describe('BidTrackingTab', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('trackingTab_rendersGalleryAndTimeline', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [{ id: 'p1', stage: 'DEPART', label: 'Remise', at: '2026-06-01T10:00:00Z', url: 'https://r2/p1.jpg' }] })
    const w = mountTab(); await flushPromises()
    expect(w.find('[data-test="section-timeline"]').exists()).toBe(true)
    expect(w.find('[data-test="bid-photos"]').exists()).toBe(true)
    expect(w.find('[data-test="photo-DEPART-0"]').exists()).toBe(true)
    expect(w.findAll('[data-test="timeline-entry"]')).toHaveLength(1)
    // Galerie active : la chronologie n'a plus d'image cliquable en double, juste une pastille.
    expect(w.find('[data-test="timeline-entry"] img').exists()).toBe(false)
    expect(w.find('[data-test="timeline-photo-pill"]').text()).toBe('Photo')
  })

  it('trackingTab_timelineErrorStillShowsGallery', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [] })
    const w = mountTab({ timeline: null, error: 'Chronologie indisponible' }); await flushPromises()
    expect(w.find('[data-test="timeline-error"]').text()).toBe('Chronologie indisponible')
    expect(w.find('[data-test="bid-photos"]').exists()).toBe(true)
  })

  it('trackingTab_legacyBackend_timelineKeepsThumbnails', async () => {
    svc.photos.mockRejectedValue(missing())
    const w = mountTab(); await flushPromises()
    expect(w.find('[data-test="timeline-photo-pill"]').exists()).toBe(false)
    expect(w.find('[data-test="timeline-entry"] img').attributes('src')).toBe('https://r2/scan.jpg')
  })

  it('trackingTab_legacyBackend_reloadAsksForFreshBid', async () => {
    svc.photos.mockRejectedValue(missing())
    const w = mountTab(); await flushPromises()
    await w.find('[data-test^="photo-"]').trigger('click')
    document.querySelector('[data-test="photo-main"]')!.dispatchEvent(new Event('error'))
    await flushPromises()
    ;(document.querySelector('[data-test="photo-reload"]') as HTMLElement).click()
    await flushPromises()
    expect(w.emitted('reload-bid')).toHaveLength(1)
    w.unmount()
  })
})
