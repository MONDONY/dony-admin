import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BidPartyCard from '@/features/bids/components/BidPartyCard.vue'
import { seedAuth } from '~/tests/helpers/auth'

const stubs = { NuxtLink: { props: ['to'], template: '<a><slot /></a>' } }
const traveler = {
  id: 'u-t-12345678', name: null, username: null, phoneMasked: null, status: null, kycStatus: 'PENDING',
  stripeAccountStatus: 'PENDING_ONBOARDING', stripeConnectUsable: false, mobileMoneyStatus: 'ACTIVE', mobileMoneyUsable: true,
}

describe('BidPartyCard', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('voyageur sans nom ni téléphone : identifiant court, Stripe non utilisable, mobile money utilisable', async () => {
    const w = mount(BidPartyCard, { props: { role: 'traveler', title: 'Voyageur', party: traveler }, global: { stubs } })
    expect(w.find('[data-test="party-traveler-link"]').text()).toBe('u-t-1234')
    expect(w.find('[data-test="party-traveler-phone"]').text()).toBe('Non renseigné')
    expect(w.find('[data-test="party-traveler-stripe"]').text()).toContain('Non utilisable')
    expect(w.find('[data-test="party-traveler-stripe"]').text()).toContain('Inscription Stripe inachevée')
    expect(w.find('[data-test="party-traveler-mobile-money"]').text()).toContain('Utilisable')
    await w.find('[data-test="party-traveler-contact"]').trigger('click')
    expect(w.emitted('contact')?.[0]).toEqual([{ id: 'u-t-12345678', name: 'u-t-1234' }])
  })

  it('ancien back : nom de repli seul, sans lien ni détails', () => {
    const w = mount(BidPartyCard, { props: { role: 'sender', title: 'Expéditeur', party: undefined, fallbackName: 'Awa' }, global: { stubs } })
    expect(w.text()).toContain('Awa')
    expect(w.find('[data-test="party-sender-link"]').exists()).toBe(false)
    expect(w.find('[data-test="party-sender-restricted"]').exists()).toBe(false)
    expect(w.find('[data-test="party-sender-contact"]').exists()).toBe(false)
  })

  it('sans USER_VIEW : nom sans lien', () => {
    seedAuth('SUPPORT', { USER_VIEW: false })
    const w = mount(BidPartyCard, { props: { role: 'traveler', title: 'Voyageur', party: { ...traveler, name: 'Moussa' } }, global: { stubs } })
    expect(w.find('[data-test="party-traveler-link"]').exists()).toBe(false)
    expect(w.text()).toContain('Moussa')
  })
})
