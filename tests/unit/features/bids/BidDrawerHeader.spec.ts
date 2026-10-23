/** En-tête collant du tiroir colis. */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidDrawerHeader from '@/features/bids/components/BidDrawerHeader.vue'
import type { AdminBidDetail } from '@/features/bids/types/index'

const bid = (over: Partial<AdminBidDetail> = {}) => ({
  id: 'b1', status: 'ACCEPTED', trackingNumber: 'DON-8ANH6EZR', refusalReason: null, ...over,
}) as AdminBidDetail
const mountHeader = (props: Record<string, unknown> = {}) => mount(BidDrawerHeader, {
  props: { bid: bid(), title: 'Paris → Bamako', countries: 'France → Mali', copied: null, ...props },
  slots: { actions: '<button data-test="slot-actions">Actions</button>' },
})

describe('BidDrawerHeader', () => {
  it('header_copyEmitsTracking : n° de suivi, titre, pays, statut, phrase, menu', async () => {
    const w = mountHeader()
    expect(w.find('[data-test="bid-tracking"]').text()).toBe('DON-8ANH6EZR')
    expect(w.find('h2#bid-detail-title').text()).toBe('Paris → Bamako')
    expect(w.find('[data-test="bid-countries"]').text()).toBe('France → Mali')
    expect(w.find('[data-test="bid-status"]').text()).toBe('Accepté')
    expect(w.find('[data-test="bid-phrase"]').text()).toContain('en attente de la remise')
    expect(w.find('[data-test="slot-actions"]').exists()).toBe(true)
    expect(w.find('[data-test="bid-copy-tracking"]').text()).toBe('Copier')
    await w.find('[data-test="bid-copy-tracking"]').trigger('click')
    expect(w.emitted('copy')?.[0]).toEqual(['DON-8ANH6EZR'])
    await w.setProps({ copied: 'tracking' })
    expect(w.find('[data-test="bid-copy-tracking"]').text()).toBe('Copié')
  })

  it('sans n° de suivi ni pays, motif de refus, bouton fermer', async () => {
    const w = mountHeader({ bid: bid({ trackingNumber: null, status: 'REJECTED', refusalReason: 'Trop lourd' }), countries: null })
    expect(w.find('[data-test="bid-tracking"]').text()).toBe('N° de suivi pas encore attribué')
    expect(w.find('[data-test="bid-copy-tracking"]').exists()).toBe(false)
    expect(w.find('[data-test="bid-countries"]').exists()).toBe(false)
    expect(w.find('[data-test="bid-refusal"]').text()).toBe('Motif du refus : Trop lourd')
    const close = w.find('[data-test="bid-close-icon"]')
    expect(close.attributes('aria-label')).toBe('Fermer la fiche')
    await close.trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
