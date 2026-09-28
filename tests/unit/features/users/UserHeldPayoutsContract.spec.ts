/**
 * Contrat définitif (yadony-back#339) : `payoutsHeldReasons` toujours présent ; un compte
 * rétabli garde des paiements retenus tant qu'ils ne sont pas débloqués un par un.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UserDetailPanel from '@/features/users/components/UserDetailPanel.vue'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] }
const global = { stubs: { NuxtLink: NuxtLinkStub } }

const baseUser = {
  id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33600', email: 'j@x.fr',
  city: 'Paris', country: 'FR', status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false,
  averageRating: 4.5, totalTrips: 2, totalShipments: 3, createdAt: '2026-01-01T00:00:00Z',
  roles: ['TRAVELER'], stripeAccountStatus: 'ONBOARDING_COMPLETE', commissionRateOverride: null,
  publishingSuspended: false, kiloPro: false, cancellationCount: 0, noShowCount: 0, refusedCount: 0,
  senderHandoverIncidentCount: 0, ratingCount: 0, deletionRequestedAt: null, messagingMutedUntil: null,
  proSubscription: null, payoutsHeldReasons: [], heldPaymentsCount: 0,
}

describe('UserDetailPanel : motifs multiples et compte rétabli', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('nouveau back sans gel ni paiement retenu : aucun bandeau', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true }, global })
    expect(w.find('[data-test="user-payouts-held"]').exists()).toBe(false)
    expect(w.find('[data-test="user-payouts-restored"]').exists()).toBe(false)
  })

  it('deux motifs : banni et identité révoquée', () => {
    const w = mount(UserDetailPanel, {
      props: { user: { ...baseUser, status: 'BANNED', payoutsHeldSince: '2026-09-20T10:00:00Z', payoutsHeldReason: 'BANNED', payoutsHeldReasons: ['BANNED', 'KYC_REVOKED'], heldPaymentsCount: 2 }, open: true },
      global,
    })
    expect(w.find('[data-test="user-payouts-held"]').text()).toContain('(compte banni et identité révoquée)')
  })

  it('un seul motif dans le tableau : lu depuis payoutsHeldReasons', () => {
    const w = mount(UserDetailPanel, {
      props: { user: { ...baseUser, payoutsHeldSince: '2026-09-20T10:00:00Z', payoutsHeldReasons: ['KYC_REVOKED'], heldPaymentsCount: 1 }, open: true },
      global,
    })
    expect(w.find('[data-test="user-payouts-held"]').text()).toContain('(identité révoquée)')
  })

  it('compte rétabli, paiements encore retenus : bandeau dédié avec lien', () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, heldPaymentsCount: 2 }, open: true }, global })
    expect(w.find('[data-test="user-payouts-held"]').exists()).toBe(false)
    const banner = w.find('[data-test="user-payouts-restored"]')
    expect(banner.text()).toContain('Compte rétabli : 2 paiements toujours retenus, à débloquer manuellement.')
    expect(w.find('[data-test="user-payouts-held-link"]').attributes('href')).toBe('/transactions?held=true')
  })

  it('compte rétabli, singulier', () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, heldPaymentsCount: 1 }, open: true }, global })
    expect(w.find('[data-test="user-payouts-restored"]').text()).toContain('Compte rétabli : 1 paiement toujours retenu, à débloquer manuellement.')
  })
})
