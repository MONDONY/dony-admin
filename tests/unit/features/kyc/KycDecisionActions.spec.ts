import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const svc = vi.hoisted(() => ({ approveKyc: vi.fn(), rejectKyc: vi.fn(), revokeKyc: vi.fn() }))
vi.mock('@/features/users/services/usersService', () => ({ usersService: svc }))

import KycDecisionActions from '@/features/kyc/components/KycDecisionActions.vue'

const BASE = {
  userId: 'u1', kycStatus: 'PENDING', verificationStatus: 'PENDING', rejectionReason: null, rejectionCode: null,
  stripeSessionId: 'sess_1', stripeStatus: 'In Review', stripeLastErrorCode: null, stripeLastErrorReason: null,
  stripeCreatedAt: '2026-09-25T10:00:00', stripeUnavailable: false, provider: 'DIDIT',
}
const VERIFIED = { ...BASE, kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED' }
const LONG = 'Pièces contrôlées chez Didit, conformes.'

function mountActions(kyc: Record<string, unknown> = BASE, userName: string | null = 'Awa Diop') {
  return mount(KycDecisionActions, { props: { kyc: kyc as never, userName } })
}

describe('KycDecisionActions', () => {
  beforeEach(() => {
    seedAuth('ADMIN')
    svc.approveKyc.mockReset(); svc.rejectKyc.mockReset(); svc.revokeKyc.mockReset()
  })

  it('identité non validée : valider et refuser, pas de révocation', () => {
    const w = mountActions()
    expect(w.find('[data-test="kyc-approve"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-reject"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-revoke"]').exists()).toBe(false)
    expect(w.find('[data-test="action-reset-kyc"]').exists()).toBe(true)
  })

  it('identité validée : seulement révoquer', () => {
    const w = mountActions(VERIFIED)
    expect(w.find('[data-test="kyc-approve"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-reject"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-revoke"]').exists()).toBe(true)
  })

  it('sans session chez le fournisseur, valider est désactivé et expliqué', () => {
    const w = mountActions({ ...BASE, stripeSessionId: null, kycStatus: 'NOT_STARTED' })
    expect(w.find('[data-test="kyc-approve"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="kyc-approve-no-session"]').exists()).toBe(true)
  })

  it('SUPPORT (sans KYC_DECIDE) garde la réinitialisation mais aucun bouton de décision', () => {
    seedAuth('SUPPORT')
    const w = mountActions()
    expect(w.find('[data-test="kyc-approve"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-reject"]').exists()).toBe(false)
    expect(mountActions(VERIFIED).find('[data-test="kyc-revoke"]').exists()).toBe(false)
    expect(w.find('[data-test="action-reset-kyc"]').exists()).toBe(true)
  })

  it('sans USER_KYC, pas de réinitialisation', () => {
    seedAuth('ADMIN', { USER_KYC: false })
    expect(mountActions().find('[data-test="action-reset-kyc"]').exists()).toBe(false)
  })

  it('valider : envoie le motif, ferme le dialogue et émet la fiche à jour', async () => {
    const updated = { ...VERIFIED, decisionKind: 'APPROVED' }
    svc.approveKyc.mockResolvedValue(updated)
    const w = mountActions()
    await w.find('[data-test="kyc-approve"]').trigger('click')
    await w.find('[data-test="kyc-checked"]').setValue(true)
    await w.find('[data-test="kyc-reason"]').setValue(LONG)
    await w.find('[data-test="kyc-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.approveKyc).toHaveBeenCalledWith('u1', LONG)
    expect(w.emitted('decided')![0]).toEqual([updated])
    expect(w.find('[data-test="kyc-dialog"]').exists()).toBe(false)
  })

  it('refuser : un 409 reste affiché dans le dialogue et demande une relecture', async () => {
    svc.rejectKyc.mockRejectedValue({ statusCode: 409, data: { code: 'kyc-already-verified', detail: 'Cette identité est déjà vérifiée.' } })
    const w = mountActions()
    await w.find('[data-test="kyc-reject"]').trigger('click')
    await w.find('[data-test="kyc-code"]').setValue('document_expired')
    await w.find('[data-test="kyc-reason"]').setValue(LONG)
    await w.find('[data-test="kyc-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="kyc-dialog-error"]').text()).toBe('Cette identité est déjà vérifiée.')
    expect(w.emitted('stale')).toHaveLength(1)
    expect(w.emitted('decided')).toBeUndefined()
  })

  it('révoquer : ressaisie du nom exigée puis envoi du code et du motif', async () => {
    svc.revokeKyc.mockResolvedValue({ ...BASE, kycStatus: 'REJECTED', decisionKind: 'REVOKED' })
    const w = mountActions(VERIFIED)
    await w.find('[data-test="kyc-revoke"]').trigger('click')
    await w.find('[data-test="kyc-code"]').setValue('suspected_fraud')
    await w.find('[data-test="kyc-reason"]').setValue('Fraude confirmée par le fournisseur après contrôle.')
    await w.find('[data-test="kyc-confirm-name"]').setValue('Awa Diop')
    await w.find('[data-test="kyc-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.revokeKyc).toHaveBeenCalledWith('u1', 'suspected_fraud', 'Fraude confirmée par le fournisseur après contrôle.')
    expect(w.emitted('decided')).toHaveLength(1)
  })

  it('sans nom connu, la ressaisie porte sur le début de l’identifiant', async () => {
    const w = mountActions({ ...VERIFIED, userId: 'abcdef12-3456' }, null)
    await w.find('[data-test="kyc-revoke"]').trigger('click')
    expect(w.text()).toContain('abcdef12')
  })

  it('ancien back (404 sans code) : dialogue fermé, actions masquées, mention discrète', async () => {
    svc.approveKyc.mockRejectedValue({ statusCode: 404, data: { detail: 'No endpoint matches this path' } })
    const w = mountActions()
    await w.find('[data-test="kyc-approve"]').trigger('click')
    await w.find('[data-test="kyc-checked"]').setValue(true)
    await w.find('[data-test="kyc-reason"]').setValue(LONG)
    await w.find('[data-test="kyc-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="kyc-dialog"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-approve"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-decisions-unavailable"]').exists()).toBe(true)
  })

  it('annuler ferme le dialogue sans appel', async () => {
    const w = mountActions()
    await w.find('[data-test="kyc-reject"]').trigger('click')
    await w.find('[data-test="kyc-dialog-cancel"]').trigger('click')
    expect(w.find('[data-test="kyc-dialog"]').exists()).toBe(false)
    expect(svc.rejectKyc).not.toHaveBeenCalled()
  })

  it('réinitialiser puis annuler : aucune émission', async () => {
    const w = mountActions()
    await w.find('[data-test="action-reset-kyc"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
    expect(w.emitted('reset')).toBeUndefined()
  })

  it('réinitialiser : confirmation avec motif puis émission', async () => {
    const w = mountActions()
    await w.find('[data-test="action-reset-kyc"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('document illisible')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('reset')![0]).toEqual(['document illisible'])
  })
})
