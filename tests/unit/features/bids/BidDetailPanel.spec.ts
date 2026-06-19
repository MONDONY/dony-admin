import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidDetailPanel from '@/features/bids/components/BidDetailPanel.vue'

const bid = {
  id: 'bid-1',
  corridor: 'Paris → Dakar',
  status: 'PENDING_TRAVELER' as const,
  senderName: 'Alice',
  travelerName: 'Bob',
  weightKg: 5,
  netEur: 40,
  declaredValueEur: 200,
  paymentMethod: 'stripe',
  trackingNumber: 'TRACK123',
  contentCategory: 'DOCUMENTS',
}

const timeline = [
  { event: 'bid_created', timestamp: '2026-06-01T10:00:00Z', details: 'Bid created' },
]

describe('BidDetailPanel', () => {
  it('renders when open', () => {
    const wrapper = mount(BidDetailPanel, {
      props: { bid, timeline, open: true },
    })
    expect(wrapper.text()).toContain('Paris → Dakar')
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('does not render when closed', () => {
    const wrapper = mount(BidDetailPanel, {
      props: { bid, timeline, open: false },
    })
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('emits close event on background click', async () => {
    const wrapper = mount(BidDetailPanel, {
      props: { bid, timeline, open: true },
    })
    const backdrop = wrapper.find('[class*="fixed"]')
    await backdrop.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close event on button click', async () => {
    const wrapper = mount(BidDetailPanel, {
      props: { bid, timeline, open: true },
    })
    await wrapper.find('[data-test="bid-close"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('handles null travelerName', () => {
    const bidNoTraveler = { ...bid, travelerName: null }
    const wrapper = mount(BidDetailPanel, {
      props: { bid: bidNoTraveler, timeline, open: true },
    })
    expect(wrapper.text()).toContain('—')
  })

  it('handles null trackingNumber', () => {
    const bidNoTracking = { ...bid, trackingNumber: null }
    const wrapper = mount(BidDetailPanel, {
      props: { bid: bidNoTracking, timeline, open: true },
    })
    expect(wrapper.text()).toMatch(/Tracking.*—/)
  })

  it('displays bid details', () => {
    const wrapper = mount(BidDetailPanel, {
      props: { bid, timeline, open: true },
    })
    expect(wrapper.text()).toContain('5 kg')
    expect(wrapper.text()).toContain('40 €')
    expect(wrapper.text()).toContain('200 €')
    expect(wrapper.text()).toContain('stripe')
  })

  it('renders null timeline gracefully', () => {
    const wrapper = mount(BidDetailPanel, {
      props: { bid, timeline: null, open: true },
    })
    expect(wrapper.text()).toContain('Timeline transaction')
  })
})
