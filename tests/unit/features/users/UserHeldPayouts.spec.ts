/**
 * Fiche utilisateur d'un voyageur dont les versements sont retenus (banni ou identité
 * révoquée) : bandeau, lien vers Transactions filtré, et rappels au moment de lever le
 * bannissement ou de valider l'identité. Un ancien back n'envoie aucun de ces champs.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UserDetailPanel from '@/features/users/components/UserDetailPanel.vue'
import KycDecisionDialog from '@/features/kyc/components/KycDecisionDialog.vue'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>', props: ['to'] }
const global = { stubs: { NuxtLink: NuxtLinkStub } }

const baseUser = {
  id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33600', email: 'j@x.fr',
  city: 'Paris', country: 'FR', status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false,
  averageRating: 4.5, totalTrips: 2, totalShipments: 3, createdAt: '2026-01-01',
  roles: ['TRAVELER'], stripeAccountStatus: 'ONBOARDING_COMPLETE', commissionRateOverride: null,
  publishingSuspended: false, kiloPro: false, cancellationCount: 0, noShowCount: 0, refusedCount: 0,
  senderHandoverIncidentCount: 0, ratingCount: 0, deletionRequestedAt: null, messagingMutedUntil: null,
  proSubscription: null,
}
const bannedHeld = {
  ...baseUser, status: 'BANNED', payoutsHeldSince: '2026-09-20T10:00:00Z', payoutsHeldReason: 'BANNED', heldPaymentsCount: 2,
}

describe('UserDetailPanel : versements bloqués', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('ancien back : aucun bandeau', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true }, global })
    expect(w.find('[data-test="user-payouts-held"]').exists()).toBe(false)
  })

  it('bandeau : date, motif et nombre de paiements en attente, lien vers Transactions filtré', () => {
    const w = mount(UserDetailPanel, { props: { user: bannedHeld, open: true }, global })
    const banner = w.find('[data-test="user-payouts-held"]')
    const date = new Date('2026-09-20T10:00:00Z').toLocaleDateString('fr-FR')
    expect(banner.text()).toContain(`Versements bloqués depuis le ${date}`)
    expect(banner.text()).toContain('compte banni')
    expect(banner.text()).toContain('2 paiements en attente')
    expect(banner.text()).not.toContain('—')
    expect(w.find('[data-test="user-payouts-held-link"]').attributes('href')).toBe('/transactions?held=true')
  })

  it('bandeau : singulier, identité révoquée', () => {
    const w = mount(UserDetailPanel, {
      props: { user: { ...baseUser, payoutsHeldSince: '2026-09-20T10:00:00Z', payoutsHeldReason: 'KYC_REVOKED', heldPaymentsCount: 1 }, open: true },
      global,
    })
    const banner = w.find('[data-test="user-payouts-held"]')
    expect(banner.text()).toContain('identité révoquée')
    expect(banner.text()).toContain('1 paiement en attente')
  })

  it('bandeau sans date connue mais avec des paiements retenus ; aucun paiement : pas de lien', () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, heldPaymentsCount: 3 }, open: true }, global })
    expect(w.find('[data-test="user-payouts-held"]').text()).toContain('Versements bloqués')
    expect(w.find('[data-test="user-payouts-held"]').text()).toContain('3 paiements en attente')

    const none = mount(UserDetailPanel, {
      props: { user: { ...baseUser, payoutsHeldSince: '2026-09-20T10:00:00Z', payoutsHeldReason: 'BANNED', heldPaymentsCount: 0 }, open: true },
      global,
    })
    expect(none.find('[data-test="user-payouts-held"]').text()).toContain('aucun paiement en attente')
    expect(none.find('[data-test="user-payouts-held-link"]').exists()).toBe(false)
  })

  it('sans PAYMENT_VIEW : bandeau sans lien vers Transactions', () => {
    seedAuth('ADMIN', { PAYMENT_VIEW: false })
    const w = mount(UserDetailPanel, { props: { user: bannedHeld, open: true }, global })
    expect(w.find('[data-test="user-payouts-held"]').exists()).toBe(true)
    expect(w.find('[data-test="user-payouts-held-link"]').exists()).toBe(false)
  })

  it('lever le bannissement : rappel que les paiements retenus ne repartent pas tout seuls', async () => {
    const w = mount(UserDetailPanel, { props: { user: bannedHeld, open: true }, global })
    await w.find('[data-test="action-unban"]').trigger('click')
    const text = w.find('[data-test="overlay"]').text()
    expect(text).toContain('ne repartiront pas tout seuls')
    expect(text).toContain('2 paiements retenus')
  })

  it('lever le bannissement sans paiement retenu : message habituel', async () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, status: 'BANNED' }, open: true }, global })
    await w.find('[data-test="action-unban"]').trigger('click')
    expect(w.find('[data-test="overlay"]').text()).not.toContain('ne repartiront pas')
  })
})

describe('KycDecisionDialog : rappel à la validation', () => {
  const base = { open: true, mode: 'approve', userName: 'Jean Dupont' } as const

  it('validation avec paiements retenus : rappel explicite', () => {
    const w = mount(KycDecisionDialog, { props: { ...base, heldPaymentsCount: 2 } })
    const reminder = w.find('[data-test="kyc-approve-held-reminder"]')
    expect(reminder.text()).toContain('2 paiements retenus')
    expect(reminder.text()).toContain('ne repartiront pas tout seuls')
  })

  it('singulier', () => {
    const w = mount(KycDecisionDialog, { props: { ...base, heldPaymentsCount: 1 } })
    expect(w.find('[data-test="kyc-approve-held-reminder"]').text()).toContain('1 paiement retenu ')
  })

  it('aucun paiement retenu, compteur absent ou autre geste : pas de rappel', () => {
    expect(mount(KycDecisionDialog, { props: { ...base } }).find('[data-test="kyc-approve-held-reminder"]').exists()).toBe(false)
    expect(mount(KycDecisionDialog, { props: { ...base, heldPaymentsCount: 0 } }).find('[data-test="kyc-approve-held-reminder"]').exists()).toBe(false)
    expect(mount(KycDecisionDialog, { props: { ...base, mode: 'reject', heldPaymentsCount: 2 } }).find('[data-test="kyc-approve-held-reminder"]').exists()).toBe(false)
  })

  it('le compteur descend de la fiche jusqu’au dialogue de validation', async () => {
    seedAuth('ADMIN')
    const kyc = { userId: 'u1', kycStatus: 'PENDING', verificationStatus: 'PENDING', stripeSessionId: 'sess_1' }
    const w = mount(UserDetailPanel, {
      props: { user: { ...bannedHeld, status: 'ACTIVE', kycStatus: 'PENDING' }, open: true, kyc }, global,
    })
    await w.find('[data-test="tab-kyc"]').trigger('click')
    await w.find('[data-test="kyc-approve"]').trigger('click')
    expect(w.find('[data-test="kyc-approve-held-reminder"]').text()).toContain('2 paiements retenus')
  })
})
