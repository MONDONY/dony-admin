import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidTimeline from '@/features/bids/components/BidTimeline.vue'

const timeline = {
  bidId: 'b1',
  entries: [
    {
      at: '2026-06-01T10:00:00Z',
      kind: 'SCAN' as const,
      label: 'Scan départ',
      detail: 'Paris',
      photoUrl: null,
      gpsLat: 48.8,
      gpsLon: 2.3
    },
    {
      at: '2026-06-02T10:00:00Z',
      kind: 'PHOTO' as const,
      label: 'Photo remise',
      detail: null,
      photoUrl: 'https://x/p.jpg'
    }
  ]
}

describe('BidTimeline', () => {
  it('renders an entry per timeline item', () => {
    const w = mount(BidTimeline, { props: { timeline } })
    expect(w.findAll('[data-test="timeline-entry"]')).toHaveLength(2)
    expect(w.text()).toContain('Scan départ')
  })
  it('renders a photo thumbnail when photoUrl present', () => {
    const w = mount(BidTimeline, { props: { timeline } })
    expect(w.find('img').attributes('src')).toBe('https://x/p.jpg')
  })
  it('handles null timeline gracefully', () => {
    const w = mount(BidTimeline, { props: { timeline: null } })
    expect(w.findAll('[data-test="timeline-entry"]')).toHaveLength(0)
  })
})
