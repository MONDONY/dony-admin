/** Onglet Résumé du tiroir : Trajet, Colis (sans photos), Identifiants. */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidSummaryTab from '@/features/bids/components/BidSummaryTab.vue'
import type { AdminBidDetail } from '@/features/bids/types/index'

const bid = {
  id: 'b1', status: 'ACCEPTED', announcementId: 'ann-1', senderName: 'Awa', travelerName: 'Moussa', corridor: 'Paris → Bamako',
  weightKg: 5, netEur: 40, currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-10-06T18:53:35',
  contentCategory: 'Vêtements', recipientName: null, trackingNumber: 'DON-1', commissionRate: null, refusalReason: null,
  description: 'Deux pagnes', photoUrls: ['https://r2.test/p1'],
  trip: {
    announcementId: 'ann-1', status: 'ACTIVE', departureCity: 'Paris', arrivalCity: 'Bamako', departureCountryCode: 'FR', arrivalCountryCode: 'ML',
    departureDate: '2026-10-12', departureTime: null, departureAt: null, arrivalDate: null, arrivalTime: null, timezone: null,
    pickupAddressLabel: null, deliveryAddressLabel: null, transportMode: null, totalKg: 23, availableKg: 15, reservedKg: 0, capacityUnit: 'KG',
    pricePerKg: null, tripGroupId: null, tripLegIndex: null, handoverDeadline: null, otherBidsCount: 3,
  },
} as AdminBidDetail
const identifiers = [{ key: 'bid', label: 'Colis', value: 'b1' }, { key: 'tracking', label: 'N° de suivi', value: 'DON-1' }]

describe('BidSummaryTab', () => {
  it('summary_hasTripParcelIds : trois sections, boutons du trajet, pas de photos', async () => {
    const w = mount(BidSummaryTab, { props: { bid, identifiers, copied: null } })
    expect(w.find('[data-test="section-trip"]').text()).toContain('Paris (France)')
    expect(w.find('[data-test="trip-departure"]').text()).toBe('lundi 12 octobre 2026')
    expect(w.find('[data-test="section-parcel"]').text()).toContain('Vêtements')
    expect(w.find('[data-test="parcel-description"]').text()).toBe('Deux pagnes')
    expect(w.find('[data-test="parcel-photos"]').exists()).toBe(false)
    expect(w.find('[data-test="section-ids"]').findAll('[data-test^="id-"]')).toHaveLength(2)
    await w.find('[data-test="trip-open-announcement"]').trigger('click')
    await w.find('[data-test="trip-other-bids"]').trigger('click')
    expect(w.emitted('show-announcement')?.[0]).toEqual(['ann-1'])
    expect(w.emitted('show-trip-bids')?.[0]).toEqual(['ann-1'])
    await w.find('[data-test="copy-tracking"]').trigger('click')
    expect(w.emitted('copy')?.[0]).toEqual(['tracking', 'DON-1'])
    await w.setProps({ copied: 'tracking' })
    expect(w.find('[data-test="copy-tracking"]').text()).toBe('Copié')
  })

  it('ancien back : trajet « non disponible »', () => {
    const legacy = { ...bid, trip: undefined, photoUrls: undefined, description: undefined }
    const w = mount(BidSummaryTab, { props: { bid: legacy, identifiers, copied: null } })
    expect(w.find('[data-test="trip-unavailable"]').text()).toBe('Non disponible pour l’instant.')
  })
})
