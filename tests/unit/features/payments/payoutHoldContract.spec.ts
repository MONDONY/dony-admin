/**
 * Contrat définitif du back (yadony-back#339) : codes 422/409 supplémentaires, blocages
 * cumulés portés par le 409, statut du compte Stripe, détection de l'ancien back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { usePaymentDetail } from '@/features/payments/composables/usePaymentDetail'
import { usePayments } from '@/features/payments/composables/usePayments'
import PayoutOverrideDialog from '@/features/payments/components/PayoutOverrideDialog.vue'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import { seedAuth } from '~/tests/helpers/auth'

const EMPTY_PAGE = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
const OVERRIDE = { overrideHold: true as const, overrideReason: 'Colis livré, contrôlé' }

function problem(status: number, data: Record<string, unknown>) {
  return Object.assign(new Error(`${status}`), { statusCode: status, data })
}

async function opened() {
  apiMock.mockResolvedValueOnce({ id: 'p1', status: 'ESCROW' })
  const d = usePaymentDetail()
  await d.open('p1')
  return d
}

describe('usePayments : détection de l’ancien back sur beneficiaryHeld', () => {
  beforeEach(() => apiMock.mockReset())

  it('nouveau back : beneficiaryHeld toujours présent, même à false, filtre accepté', async () => {
    apiMock.mockResolvedValue({ ...EMPTY_PAGE, content: [{ id: 'p1', beneficiaryHeld: false, payoutHeldAt: '2026-09-20T10:00:00Z' }] })
    const p = usePayments()
    await p.setHeldFilter(true)
    expect(p.heldFilterUnsupported.value).toBe(false)
    expect(p.payments.value).toHaveLength(1)
  })

  it('ancien back : aucun élément ne porte beneficiaryHeld, filtre signalé indisponible', async () => {
    apiMock.mockResolvedValue({ ...EMPTY_PAGE, content: [{ id: 'p1' }] })
    const p = usePayments()
    await p.setHeldFilter(true)
    expect(p.heldFilterUnsupported.value).toBe(true)
  })
})

describe('usePaymentDetail : codes du contrat définitif', () => {
  beforeEach(() => apiMock.mockReset())

  it('409 : blocages cumulés, motifs et voyageur relayés dans la demande de dérogation', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(problem(409, {
      code: 'payment-disputed', detail: 'x', blockers: ['DISPUTED', 'BENEFICIARY_HELD'], holdReasons: ['BANNED', 'KYC_REVOKED'], travelerId: 't1',
    }))
    await d.forceRelease()
    expect(d.overrideRequest.value).toEqual({
      action: 'release', code: 'payment-disputed', blockers: ['DISPUTED', 'BENEFICIARY_HELD'], holdReasons: ['BANNED', 'KYC_REVOKED'], travelerId: 't1',
    })
    expect(d.error.value).toContain('litige bancaire')
    expect(d.error.value).toContain('gelé')
  })

  it('409 sans blockers (forme minimale) : listes vides', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(problem(409, { code: 'payout-beneficiary-held' }))
    await d.forceRelease()
    expect(d.overrideRequest.value).toMatchObject({ blockers: [], holdReasons: [], travelerId: null })
  })

  it('422 override-reason-invalid : detail affiché dans le dialogue, pas dans le bandeau', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(problem(422, { code: 'override-reason-invalid', detail: 'Le motif doit faire entre 10 et 500 caractères' }))
    expect(await d.forceRelease(OVERRIDE)).toBe(false)
    expect(d.overrideError.value).toBe('Le motif doit faire entre 10 et 500 caractères')
    expect(d.error.value).toBeNull()
  })

  it('l’erreur de motif s’efface au geste suivant et à la fermeture de la dérogation', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(problem(422, { code: 'override-reason-invalid', detail: 'Motif refusé' }))
    await d.retryPayout(OVERRIDE)
    expect(d.overrideError.value).toBe('Motif refusé')
    d.dismissOverride()
    expect(d.overrideError.value).toBeNull()
    apiMock.mockRejectedValueOnce(problem(422, { code: 'override-reason-invalid', detail: 'Motif refusé' }))
    await d.retryPayout(OVERRIDE)
    apiMock.mockResolvedValueOnce({ id: 'p1', status: 'RELEASED' })
    await d.retryPayout(OVERRIDE)
    expect(d.overrideError.value).toBeNull()
  })

  it('409 transfer-already-attempted : message clair, conseil Stripe, pas de dérogation', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(problem(409, { code: 'transfer-already-attempted', detail: 'x' }))
    expect(await d.forceRelease()).toBe(false)
    expect(d.overrideRequest.value).toBeNull()
    expect(d.error.value).toContain('transfert Stripe a déjà été tenté')
    expect(d.error.value).toContain('Vérifiez dans Stripe')
  })

  it('409 stripe-account-unusable : statut du compte affiché', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(problem(409, { code: 'stripe-account-unusable', stripeAccountStatus: 'DISABLED' }))
    await d.forceRelease()
    expect(d.error.value).toContain('compte Stripe du voyageur')
    expect(d.error.value).toContain('désactivé')
    apiMock.mockRejectedValueOnce(problem(409, { code: 'stripe-account-unusable', stripeAccountStatus: 'REJECTED' }))
    await d.forceRelease()
    expect(d.error.value).toContain('refusé')
    apiMock.mockRejectedValueOnce(problem(409, { code: 'stripe-account-unusable', stripeAccountStatus: 'AUTRE' }))
    await d.forceRelease()
    expect(d.error.value).toContain('AUTRE')
  })

  it('422 payment-not-in-escrow : erreur ordinaire, jamais de dérogation', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(problem(422, { code: 'payment-not-in-escrow', detail: 'Le paiement n’est plus sous séquestre' }))
    await d.forceRelease()
    expect(d.overrideRequest.value).toBeNull()
    expect(d.error.value).toBe('Le paiement n’est plus sous séquestre')
  })
})

describe('PayoutOverrideDialog : blocages cumulés et erreur de motif', () => {
  const mountDialog = (props: Record<string, unknown> = {}) =>
    mount(PayoutOverrideDialog, { props: { open: true, action: 'release', ...props } })

  it('litige bancaire ET compte gelé : les deux blocages affichés', () => {
    const w = mountDialog({ blockers: ['DISPUTED', 'BENEFICIARY_HELD'], holdReasons: ['BANNED'] })
    expect(w.find('[data-test="override-blocker-DISPUTED"]').text()).toContain('litige bancaire')
    expect(w.find('[data-test="override-blocker-BENEFICIARY_HELD"]').text()).toContain('banni')
  })

  it('deux motifs de gel : banni et identité révoquée', () => {
    const w = mountDialog({ blockers: ['BENEFICIARY_HELD'], holdReasons: ['BANNED', 'KYC_REVOKED'] })
    expect(w.find('[data-test="override-blocker-BENEFICIARY_HELD"]').text()).toContain('banni et son identité a été révoquée')
    expect(w.find('[data-test="override-blocker-DISPUTED"]').exists()).toBe(false)
  })

  it('litige seul : pas de paragraphe de gel', () => {
    const w = mountDialog({ blockers: ['DISPUTED'] })
    expect(w.find('[data-test="override-blocker-BENEFICIARY_HELD"]').exists()).toBe(false)
  })

  it('erreur de motif du serveur affichée dans le dialogue', () => {
    const w = mountDialog({ error: 'Le motif doit faire entre 10 et 500 caractères' })
    expect(w.find('[data-test="override-error"]').text()).toBe('Le motif doit faire entre 10 et 500 caractères')
    expect(mountDialog().find('[data-test="override-error"]').exists()).toBe(false)
  })
})

describe('PaymentDetailPanel : cycle de la dérogation', () => {
  beforeEach(() => seedAuth('ADMIN'))
  const held = {
    id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 1000, commissionCents: 120, currency: 'EUR',
    createdAt: '2026-09-01T10:00:00Z', refundedCents: 0, stripePaymentIntentId: 'pi', escrowReleasedAt: null, disputed: true,
    beneficiaryHeld: true, beneficiaryHoldReason: 'KYC_REVOKED', payoutHeldAt: '2026-09-20T10:00:00Z',
  } as const

  async function submitOverride(w: ReturnType<typeof mount>) {
    await w.find('[data-test="action-release"]').trigger('click')
    await w.find('[data-test="override-checked"]').setValue(true)
    await w.find('[data-test="override-reason"]').setValue('Livraison vérifiée par photo')
    await w.find('[data-test="override-submit"]').trigger('click')
  }

  it('paiement retenu ET en litige : les deux blocages dès l’ouverture', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: held, open: true } })
    await w.find('[data-test="action-release"]').trigger('click')
    expect(w.find('[data-test="override-blocker-DISPUTED"]').exists()).toBe(true)
    expect(w.find('[data-test="override-blocker-BENEFICIARY_HELD"]').text()).toContain('identité')
  })

  it('le 409 prime : ses blockers et motifs remplacent la lecture du paiement', async () => {
    const w = mount(PaymentDetailPanel, {
      props: { payment: { ...held, disputed: false }, open: true, overrideRequest: { action: 'release', code: 'payment-disputed', blockers: ['DISPUTED'], holdReasons: [], travelerId: null } },
    })
    expect(w.find('[data-test="override-blocker-DISPUTED"]').exists()).toBe(true)
    expect(w.find('[data-test="override-blocker-BENEFICIARY_HELD"]').exists()).toBe(false)
  })

  it('409 sans blockers : déduits du code', async () => {
    const w = mount(PaymentDetailPanel, {
      props: { payment: { ...held, beneficiaryHeld: false, payoutHeldAt: null, disputed: false }, open: true, overrideRequest: { action: 'release', code: 'payout-beneficiary-held', blockers: [], holdReasons: [], travelerId: null } },
    })
    expect(w.find('[data-test="override-blocker-BENEFICIARY_HELD"]').exists()).toBe(true)
    expect(w.find('[data-test="override-blocker-DISPUTED"]').exists()).toBe(false)
  })

  it('refus du motif (overrideError) : le dialogue reste ouvert, saisie conservée', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: held, open: true } })
    await submitOverride(w)
    expect(w.emitted('force-release')?.[0]).toEqual([{ overrideHold: true, overrideReason: 'Livraison vérifiée par photo' }])
    await w.setProps({ busy: true })
    await w.setProps({ busy: false, overrideError: 'Motif refusé par le serveur' })
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(true)
    expect(w.find('[data-test="override-error"]').text()).toBe('Motif refusé par le serveur')
    expect((w.find('[data-test="override-reason"]').element as HTMLTextAreaElement).value).toBe('Livraison vérifiée par photo')
  })

  it('fin de l’appel sans erreur de motif : le dialogue se ferme', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: held, open: true } })
    await submitOverride(w)
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(true)
    await w.setProps({ busy: true })
    await w.setProps({ busy: false })
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(false)
  })
})
