/** Rangée des trois personnes du colis. */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BidPartiesRow from '@/features/bids/components/BidPartiesRow.vue'
import type { AdminBidDetail } from '@/features/bids/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const stubs = { NuxtLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } }
const party = (id: string, name: string) => ({
  id, name, username: null, phoneMasked: '•••• 0000', status: 'ACTIVE', kycStatus: 'VERIFIED',
  stripeAccountStatus: null, stripeConnectUsable: null, mobileMoneyStatus: null, mobileMoneyUsable: null,
})
const bid = (over: Partial<AdminBidDetail> = {}) => ({
  id: 'b1', senderName: 'Awa', travelerName: 'Moussa', recipientName: 'Fatou',
  sender: party('u-s', 'Awa Ndiaye'), traveler: party('u-t', 'Moussa Diallo'),
  recipient: { name: 'Fatou Keita', phoneMasked: '•••• 1122' }, ...over,
}) as AdminBidDetail

describe('BidPartiesRow', () => {
  beforeEach(() => { seedAuth('SUPER_ADMIN') })

  it('partiesRow_recipientMasked : trois cartes, téléphone du destinataire masqué, contact relayé', async () => {
    const w = mount(BidPartiesRow, { props: { bid: bid() }, global: { stubs } })
    expect(w.find('[data-test="section-people"]').exists()).toBe(true)
    expect(w.find('[data-test="party-sender"]').text()).toContain('Awa Ndiaye')
    expect(w.find('[data-test="party-traveler"]').text()).toContain('Moussa Diallo')
    expect(w.find('[data-test="party-recipient"]').text()).toContain('Fatou Keita')
    expect(w.find('[data-test="recipient-phone"]').text()).toBe('•••• 1122')
    await w.find('[data-test="party-sender-contact"]').trigger('click')
    expect(w.emitted('contact')?.[0]).toEqual([{ id: 'u-s', name: 'Awa Ndiaye' }])
  })

  it('ancien back : noms de repli, destinataire sans téléphone', () => {
    const w = mount(BidPartiesRow, { props: { bid: bid({ sender: undefined, traveler: undefined, recipient: undefined }) }, global: { stubs } })
    expect(w.find('[data-test="party-sender"]').text()).toContain('Awa')
    expect(w.find('[data-test="party-recipient"]').text()).toContain('Fatou')
    expect(w.find('[data-test="recipient-phone"]').exists()).toBe(false)
    const none = mount(BidPartiesRow, { props: { bid: bid({ recipient: undefined, recipientName: null }) }, global: { stubs } })
    expect(none.find('[data-test="party-recipient"]').text()).toContain('Non renseigné')
  })
})
