import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UserKycTab from '@/features/users/components/UserKycTab.vue'
import { seedAuth } from '~/tests/helpers/auth'

const KYC = {
  userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED',
  rejectionReason: 'document_expired', rejectionCode: 'document_expired',
  stripeSessionId: 'vs_001', stripeStatus: 'requires_input',
  stripeLastErrorCode: 'document_expired', stripeLastErrorReason: 'The document has expired.',
  stripeCreatedAt: '2026-08-01T10:00:00', stripeUnavailable: false,
}

describe('UserKycTab', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('affiche les deux statuts et la session Stripe courante', () => {
    const w = mount(UserKycTab, { props: { kyc: KYC } })
    expect(w.find('[data-test="kyc-status"]').text()).toContain('REJECTED')
    expect(w.find('[data-test="kyc-verification-status"]').text()).toContain('REJECTED')
    expect(w.find('[data-test="kyc-stripe-session"]').text()).toContain('vs_001')
    expect(w.text()).toContain('The document has expired.')
  })

  it('signale une indisponibilité Stripe sans masquer les données locales', () => {
    const w = mount(UserKycTab, {
      props: { kyc: { ...KYC, stripeStatus: null, stripeLastErrorCode: null, stripeLastErrorReason: null, stripeUnavailable: true } },
    })
    expect(w.find('[data-test="kyc-stripe-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-status"]').text()).toContain('REJECTED')
  })

  it('indique clairement l\'absence de vérification démarrée', () => {
    const w = mount(UserKycTab, {
      props: {
        kyc: {
          ...KYC, kycStatus: 'NOT_STARTED', verificationStatus: 'NOT_STARTED',
          rejectionReason: null, rejectionCode: null, stripeSessionId: null,
          stripeStatus: null, stripeLastErrorCode: null, stripeLastErrorReason: null,
          stripeCreatedAt: null, stripeUnavailable: false,
        },
      },
    })
    expect(w.find('[data-test="kyc-stripe-session"]').text()).toContain('Aucune session')
  })

  it('émet reset avec le motif après confirmation', async () => {
    const w = mount(UserKycTab, { props: { kyc: KYC } })
    await w.find('[data-test="action-reset-kyc"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('document illisible')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('reset')![0]).toEqual(['document illisible'])
  })

  it('cache le bouton de réinitialisation sans la permission USER_KYC', () => {
    seedAuth('ADMIN', { USER_KYC: false })
    const w = mount(UserKycTab, { props: { kyc: KYC } })
    expect(w.find('[data-test="action-reset-kyc"]').exists()).toBe(false)
  })

  it('affiche l\'erreur remontée par le back', () => {
    const w = mount(UserKycTab, { props: { kyc: KYC, error: 'Action échouée' } })
    expect(w.find('[data-test="kyc-error"]').text()).toContain('Action échouée')
  })
})
