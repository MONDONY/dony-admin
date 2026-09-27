import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.mock('@/features/users/services/usersService', () => ({ usersService: { approveKyc: vi.fn(), rejectKyc: vi.fn(), revokeKyc: vi.fn() } }))

import KycDetailPanel from '@/features/kyc/components/KycDetailPanel.vue'

const ROW = {
  userId: 'u1', userName: 'Awa Diop', userPhone: '+221 77 *** ** 12', provider: 'DIDIT', kycStatus: 'REJECTED',
  submittedAt: '2026-09-25T10:00:00Z', waitingHours: 50,
}
const KYC = {
  userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED', rejectionReason: 'Passeport expiré en 2024',
  rejectionCode: 'document_expired', stripeSessionId: 'sess_1', stripeUnavailable: false, provider: 'DIDIT', history: [],
}
const NuxtLink = { props: ['to'], template: '<a :data-to="to"><slot /></a>' }

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(KycDetailPanel, {
    props: { row: ROW, userId: 'u1', kyc: KYC, loading: false, error: null, ...props } as never,
    global: { stubs: { NuxtLink } },
  })
}

describe('KycDetailPanel', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('en-tête, statut, fournisseur, refus et lien vers la fiche utilisateur', () => {
    const w = mountPanel()
    expect(w.find('#kyc-detail-title').text()).toBe('Awa Diop')
    expect(w.text()).toContain('+221 77 *** ** 12')
    expect(w.find('[data-test="kyc-detail-status"]').text()).toContain('Refusée')
    expect(w.find('[data-test="kyc-detail-provider"]').text()).toBe('Didit')
    expect(w.find('[data-test="kyc-detail-rejection"]').text()).toContain('Document expiré')
    expect(w.find('[data-test="kyc-detail-rejection"]').text()).toContain('Passeport expiré en 2024')
    expect(w.find('[data-test="kyc-user-link"]').attributes('data-to')).toBe('/users?open=u1')
    expect(w.find('[data-test="kyc-actions"]').exists()).toBe(true)
    expect(w.text()).not.toContain('—')
  })

  it('sans ligne de file (lien profond) : repli sur l’identifiant', () => {
    const w = mountPanel({ row: null })
    expect(w.find('#kyc-detail-title').text()).toContain('u1')
  })

  it('chargement et erreur', () => {
    expect(mountPanel({ kyc: null, loading: true }).find('[data-test="kyc-detail-loading"]').exists()).toBe(true)
    const w = mountPanel({ kyc: null, error: 'Utilisateur introuvable' })
    expect(w.find('[data-test="kyc-detail-error"]').text()).toBe('Utilisateur introuvable')
    expect(w.find('[data-test="kyc-actions"]').exists()).toBe(false)
  })

  it('indisponibilité du fournisseur signalée', () => {
    const w = mountPanel({ kyc: { ...KYC, stripeUnavailable: true } })
    expect(w.find('[data-test="kyc-provider-unavailable"]').exists()).toBe(true)
  })

  it('erreur d’action (fiche chargée) affichée sans masquer la fiche', () => {
    expect(mountPanel({ error: 'Réinitialisation impossible' }).find('[data-test="kyc-reset-error"]').text()).toBe('Réinitialisation impossible')
  })

  it('fermeture par le bouton et par le fond, relais des événements', async () => {
    const w = mountPanel()
    await w.find('[data-test="kyc-detail-close"]').trigger('click')
    await w.find('[data-test="kyc-detail-overlay"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(2)
    const actions = w.findComponent({ name: 'KycDecisionActions' })
    actions.vm.$emit('decided', KYC)
    actions.vm.$emit('stale')
    actions.vm.$emit('reset', 'motif')
    expect(w.emitted('decided')![0]).toEqual([KYC])
    expect(w.emitted('stale')).toHaveLength(1)
    expect(w.emitted('reset')![0]).toEqual(['motif'])
  })
})
