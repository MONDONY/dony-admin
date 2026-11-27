import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KycReviewDetails from '@/features/kyc/components/KycReviewDetails.vue'

const BASE = { userId: 'u1', kycStatus: 'NOT_STARTED', verificationStatus: 'PENDING', stripeSessionId: 's1' }

describe('KycReviewDetails — parcours', () => {
  it('affiche l’étape atteinte et la raison donnée', () => {
    const w = mount(KycReviewDetails, {
      props: { kyc: { ...BASE, providerStep: 'LIVENESS', providerStepFinished: false, abandonReason: 'TOO_LONG' } },
    })
    expect(w.find('[data-test="kyc-step"]').text()).toBe('Arrêté pendant le selfie de vivacité')
    expect(w.find('[data-test="kyc-abandon-reason"]').text()).toContain('Trop long')
  })

  it('masque la section pour un ancien back sans étape ni raison', () => {
    const w = mount(KycReviewDetails, { props: { kyc: BASE } })
    expect(w.find('[data-test="kyc-journey"]').exists()).toBe(false)
  })

  it('traduit la raison dans l’historique', () => {
    const w = mount(KycReviewDetails, {
      props: {
        kyc: {
          ...BASE,
          history: [{ action: 'KYC_ABANDON_REASON', at: '2026-11-27T10:00:00', actorKind: 'USER', actorEmail: null, detail: 'PRIVACY' }],
        },
      },
    })
    expect(w.find('[data-test="kyc-history-item-0"]').text()).toContain('Raison donnée en quittant')
    expect(w.find('[data-test="kyc-history-item-0"]').text()).toContain('Ne veut pas partager ses documents')
  })
})
