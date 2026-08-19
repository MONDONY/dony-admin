import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UserDetailPanel from '@/features/users/components/UserDetailPanel.vue'
import { seedAuth } from '~/tests/helpers/auth'

/**
 * Le backend tourne en `spring.jackson.default-property-inclusion: NON_NULL` : un champ nul
 * est **absent** du JSON, il n'arrive jamais à `null`. Les fixtures de `UserDetailPanel.spec`
 * posent `null` explicitement — une forme que le serveur n'émet pas, ce qui masque toute
 * comparaison `!== null` : elle est vraie sur `undefined`.
 *
 * Ce fichier monte le panneau avec le format RÉEL du fil, champs simplement absents.
 */

// Aucun champ nullable posé : c'est exactement ce que le back envoie pour un compte
// ordinaire, sans dérogation de commission et jamais modéré.
const wireUser = {
  id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33600', email: 'j@x.fr',
  city: 'Paris', country: 'FR', status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false,
  averageRating: 4.5, totalTrips: 2, totalShipments: 3, createdAt: '2026-01-01',
  roles: ['SENDER'], stripeAccountStatus: 'ONBOARDING_COMPLETE',
  publishingSuspended: false, kiloPro: false, cancellationCount: 0, noShowCount: 1,
  refusedCount: 0, senderHandoverIncidentCount: 0, ratingCount: 10,
}

describe('UserDetailPanel — format réel du fil (champs absents, pas null)', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('sans dérogation de commission : annonce le taux global, jamais « NaN % »', () => {
    const w = mount(UserDetailPanel, { props: { user: wireUser, open: true } })
    expect(w.text()).toContain('taux global appliqué')
    expect(w.text()).not.toContain('NaN')
  })

  it('sans dérogation de commission : pas de bouton « Réinitialiser »', () => {
    const w = mount(UserDetailPanel, { props: { user: wireUser, open: true } })
    expect(w.find('[data-test="commission-reset"]').exists()).toBe(false)
  })

  it('sans dérogation de commission : le champ de saisie est vide, pas prérempli à « NaN »', () => {
    const w = mount(UserDetailPanel, { props: { user: wireUser, open: true } })
    const input = w.find('[data-test="commission-input"]').element as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('jamais coupé : pas de bouton « Rétablir la messagerie »', () => {
    const w = mount(UserDetailPanel, { props: { user: wireUser, open: true } })
    expect(w.find('[data-test="action-unmute"]').exists()).toBe(false)
  })

  it('avec une dérogation réelle, l’affichage et le bouton reviennent', () => {
    const w = mount(UserDetailPanel, {
      props: { user: { ...wireUser, commissionRateOverride: 0.08 }, open: true },
    })
    expect(w.text()).toContain('8.0 %')
    expect(w.find('[data-test="commission-reset"]').exists()).toBe(true)
  })

  it('réellement coupé : le bouton « Rétablir la messagerie » est proposé', () => {
    const w = mount(UserDetailPanel, {
      props: { user: { ...wireUser, messagingMutedUntil: '2026-09-01T10:00:00Z' }, open: true },
    })
    expect(w.find('[data-test="action-unmute"]').exists()).toBe(true)
  })
})
