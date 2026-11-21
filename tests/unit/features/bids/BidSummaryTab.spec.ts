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
    const w = mount(BidSummaryTab, { props: { bid, identifiers, copied: null, legacy: false } })
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

  it('ancien back (prop `legacy` du tiroir) : trajet « non disponible » ; sinon annonce supprimée', () => {
    const noTrip = { ...bid, trip: undefined, photoUrls: undefined, description: undefined }
    const w = mount(BidSummaryTab, { props: { bid: noTrip, identifiers, copied: null, legacy: true } })
    expect(w.find('[data-test="trip-unavailable"]').text()).toBe('Non disponible pour l’instant.')
    const gone = mount(BidSummaryTab, { props: { bid: { ...bid, trip: null }, identifiers, copied: null, legacy: false } })
    expect(gone.find('[data-test="trip-unavailable"]').text()).toBe('L’annonce de ce colis n’existe plus.')
  })

  it('trajet bateau au m³ : capacité et prix au m³, volume du colis, jamais « null kg »', () => {
    const boat = {
      ...bid, volumeM3: 0.576,
      trip: { ...bid.trip!, transportMode: 'BOAT', totalKg: null, availableKg: null, pricePerKg: null, volumeCapacityM3: 40, availableVolumeM3: 12.5, pricePerM3: 90 },
    } as AdminBidDetail
    const w = mount(BidSummaryTab, { props: { bid: boat, identifiers, copied: null, legacy: false } })
    expect(w.get('[data-test="trip-capacity"]').text()).toBe('12,5 m³ restants sur 40 m³')
    expect(w.get('[data-test="section-trip"]').text()).toContain('Prix au m³')
    expect(w.get('[data-test="trip-price"]').text()).toContain('90')
    expect(w.get('[data-test="parcel-volume"]').text()).toBe('0,576 m³')
    expect(w.text()).not.toContain('null')
    expect(w.text()).not.toContain('undefined')
  })

  it('trajet au kilo : prix au kilo, pas de ligne Volume sans volumeM3 ; sans capacité « — »', () => {
    const kg = { ...bid, trip: { ...bid.trip!, pricePerKg: 8 } } as AdminBidDetail
    const w = mount(BidSummaryTab, { props: { bid: kg, identifiers, copied: null, legacy: false } })
    expect(w.get('[data-test="section-trip"]').text()).toContain('Prix au kilo')
    expect(w.find('[data-test="parcel-volume"]').exists()).toBe(false)
    const empty = { ...bid, trip: { ...bid.trip!, totalKg: null, availableKg: null } } as AdminBidDetail
    const w2 = mount(BidSummaryTab, { props: { bid: empty, identifiers, copied: null, legacy: false } })
    expect(w2.get('[data-test="trip-capacity"]').text()).toBe('—')
    expect(w2.get('[data-test="section-trip"]').text()).not.toContain('Prix au')
  })
})
