/** Section « Corriger » des alertes de séquestre carte (RECON_STRIPE_, ESCROW_J48_TIMEOUT, ESCROW_CAPTURE_FAILED_). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import type { AdminAlert } from '@/features/alerts/types/index'

const alertsSvc = vi.hoisted(() => ({ violations: vi.fn() }))
vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: alertsSvc }))
const paySvc = vi.hoisted(() => ({ get: vi.fn(), resyncStripe: vi.fn(), forceRelease: vi.fn() }))
vi.mock('@/features/payments/services/paymentsService', () => ({ paymentsService: paySvc }))

import AlertDetailPanel from '@/features/alerts/components/AlertDetailPanel.vue'
import { resetStripeResyncAvailability } from '@/features/payments/composables/useStripeResync'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="JSON.stringify(to)"><slot /></a>' }
const P = '11111111-2222-3333-4444-555555555555'
const B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const T = 'cccccccc-1111-2222-3333-444444444444'

function alert(over: Partial<AdminAlert> = {}): AdminAlert {
  return {
    id: 'a1', type: `RECON_STRIPE_${P}`, severity: 'CRITICAL', detail: 'Écart Stripe',
    payload: { prestataire: 'STRIPE', reference: P, ecart: 'SEQUESTRE_NON_CAPTURE', detail: 'base : ESCROW' },
    resolved: false, resolvedAt: null, createdAt: '2026-10-10T04:30:00', paymentId: P, ...over,
  }
}

function payment(over: Record<string, unknown> = {}) {
  return {
    id: P, bidId: null, status: 'ESCROW', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR',
    createdAt: '2026-10-07T10:00:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false,
    capturedAt: null, negotiationThreadId: T,
    insight: { kind: 'NEGOTIATION', bidId: B, negotiationThreadId: T, sender: null, traveler: { id: 'u2', name: 'Awa' }, departureCity: null, arrivalCity: null, bidStatus: 'DELIVERED', abandoned: false, netTravelerCents: 5676, capturedAt: null, fxExchangeRate: null, stripeChargeId: null, stripeDashboardUrl: null },
    ...over,
  }
}

function resync(over: Record<string, unknown> = {}) {
  return {
    paymentId: P, paymentIntentId: 'pi_1', action: 'ESCROW_CAPTURED', changed: true,
    before: { status: 'ESCROW', capturedAt: null, stripeStatus: 'requires_capture', amountCapturable: 6450 },
    after: { status: 'ESCROW', capturedAt: '2026-10-10T08:00:00Z', stripeStatus: 'succeeded', amountCapturable: 0 },
    message: 'Séquestre capturé', resolvedAlertIds: ['a1'], openAlertIds: [], alertResolvable: false, ...over,
  }
}

const mountPanel = (a: AdminAlert) => mount(AlertDetailPanel, { props: { alert: a }, global: { stubs: { NuxtLink } } })

async function clickResync(w: ReturnType<typeof mountPanel>) {
  await w.find('[data-test="resync-stripe"]').trigger('click')
  await flushPromises()
}

describe('AlertDetailPanel — section « Corriger »', () => {
  beforeEach(() => {
    seedAuth('SUPER_ADMIN')
    resetStripeResyncAvailability()
    alertsSvc.violations.mockReset()
    paySvc.get.mockReset().mockResolvedValue(payment())
    paySvc.resyncStripe.mockReset()
    paySvc.forceRelease.mockReset()
  })

  it.each([
    ['RECON_STRIPE_', alert(), 'Écart de rapprochement Stripe'],
    ['RECON_STRIPE_ ancien back (sans paymentId)', alert({ paymentId: undefined }), 'Écart de rapprochement Stripe'],
    ['ESCROW_J48_TIMEOUT', alert({ type: 'ESCROW_J48_TIMEOUT', paymentId: undefined, payload: { paymentId: P } }), 'Paiement en séquestre depuis plus de 48 h'],
    ['ESCROW_CAPTURE_FAILED_', alert({ type: `ESCROW_CAPTURE_FAILED_${P}`, paymentId: null, payload: {} }), 'Encaissement du séquestre impossible'],
  ])('%s : section, étapes concrètes et liens', async (_label, a, title) => {
    const w = mountPanel(a)
    await flushPromises()
    expect(w.find('[data-test="alert-detail-title"]').text()).toBe(title)
    const steps = w.find('[data-test="alert-detail-actions"]').findAll('li').map(li => li.text())
    expect(steps[0]).toContain('Resynchroniser avec Stripe')
    expect(steps[1]).toContain('Forcer le versement au voyageur')
    expect(steps[2]).toContain('Autorisation carte expirée')
    expect(w.find('[data-test="alert-fix"]').exists()).toBe(true)
    expect(paySvc.get).toHaveBeenCalledWith(P)
    expect(w.find('[data-test="alert-fix-payment-link"]').attributes('href')).toContain(`"open":"${P}"`)
    expect(w.find('[data-test="alert-fix-bid-link"]').attributes('href')).toContain(B)
    expect(w.find('[data-test="alert-fix-thread"]').text()).toContain(T)
    expect(w.find('[data-test="alert-fix-release"]').exists()).toBe(true)
  })

  it('alerte sans paiement identifiable : pas de section', () => {
    const w = mountPanel(alert({ type: 'ESCROW_J48_TIMEOUT', paymentId: undefined, payload: { bidId: B } }))
    expect(w.find('[data-test="alert-fix"]').exists()).toBe(false)
  })

  it('résolution automatique : l’alerte est signalée résolue et la liste prévenue', async () => {
    paySvc.resyncStripe.mockResolvedValue(resync())
    const w = mountPanel(alert())
    await clickResync(w)
    expect(w.emitted('auto-resolved')![0]).toEqual([['a1']])
    expect(w.find('[data-test="alert-fix-auto-resolved"]').text()).toContain('Alerte résolue automatiquement')
    expect(w.find('[data-test="alert-fix-resolve"]').exists()).toBe(false)
    expect(paySvc.get).toHaveBeenCalledTimes(2)
  })

  it('alerte restée ouverte mais résoluble : propose « Marquer comme résolue »', async () => {
    paySvc.resyncStripe.mockResolvedValue(resync({ action: 'ALREADY_IN_SYNC', changed: false, resolvedAlertIds: [], openAlertIds: ['a1'], alertResolvable: true }))
    const w = mountPanel(alert())
    await clickResync(w)
    expect(w.emitted('auto-resolved')).toBeUndefined()
    await w.find('[data-test="alert-fix-resolve"]').trigger('click')
    expect(w.emitted('resolve')![0]).toEqual(['a1'])
  })

  it('paiement sorti du séquestre après resynchronisation : plus de versement forcé', async () => {
    paySvc.resyncStripe.mockResolvedValue(resync({ action: 'MARKED_CANCELLED', after: { status: 'CANCELLED', capturedAt: null, stripeStatus: 'canceled', amountCapturable: 0 }, resolvedAlertIds: [] }))
    paySvc.get.mockResolvedValueOnce(payment({ status: 'PENDING' })).mockRejectedValueOnce(new Error('down'))
    const w = mountPanel(alert())
    await flushPromises()
    expect(w.find('[data-test="alert-fix-release"]').exists()).toBe(false)
    await clickResync(w)
    expect(w.find('[data-test="resync-action"]').text()).toContain('Paiement marqué annulé')
    expect(w.find('[data-test="alert-fix-release"]').exists()).toBe(false)
  })

  it('paiement passé en séquestre par la resynchronisation : versement proposé', async () => {
    paySvc.get.mockResolvedValue(payment({ status: 'PENDING' }))
    paySvc.resyncStripe.mockResolvedValue(resync({ action: 'ESCROW_ACTIVATED', resolvedAlertIds: [] }))
    const w = mountPanel(alert())
    await flushPromises()
    expect(w.find('[data-test="alert-fix-release"]').exists()).toBe(false)
    paySvc.get.mockRejectedValue(new Error('down'))
    await clickResync(w)
    expect(w.find('[data-test="alert-fix-release"]').exists()).toBe(true)
  })

  it('forcer le versement : confirmation avec montant et destinataire, un seul appel', async () => {
    let done!: (_v: unknown) => void
    paySvc.forceRelease.mockReturnValue(new Promise(res => { done = res }))
    const w = mountPanel(alert())
    await flushPromises()
    await w.find('[data-test="alert-fix-release"]').trigger('click')
    expect(w.text()).toContain('56,76 EUR seront versés au voyageur Awa')
    await w.find('[data-test="confirm"]').trigger('click')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.find('[data-test="alert-fix-release"]').text()).toBe('Versement en cours…')
    done(payment({ status: 'RELEASED' }))
    await flushPromises()
    expect(paySvc.forceRelease).toHaveBeenCalledTimes(1)
    expect(paySvc.forceRelease).toHaveBeenCalledWith(P)
    expect(w.find('[data-test="alert-fix-released"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-fix-release"]').exists()).toBe(false)
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('forcer le versement sans fiche paiement : montant et destinataire génériques, annulation possible', async () => {
    paySvc.get.mockResolvedValue(payment({ insight: null, travelerId: null }))
    const w = mountPanel(alert())
    await flushPromises()
    await w.find('[data-test="alert-fix-release"]').trigger('click')
    expect(w.text()).toContain('56,76 EUR seront versés au voyageur.')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.find('[data-test="confirm"]').exists()).toBe(false)
    expect(paySvc.forceRelease).not.toHaveBeenCalled()
  })

  it.each([
    ['escrow-capture-failed', 'Encaissement de la carte impossible'],
    ['payout-beneficiary-held', 'dérogation motivée'],
    ['stripe-account-unusable', 'compte Stripe du voyageur est inutilisable'],
    ['transfer-already-attempted', 'déjà été tenté'],
  ])('erreur du versement forcé %s', async (code, text) => {
    paySvc.forceRelease.mockRejectedValue({ statusCode: 422, data: { code } })
    const w = mountPanel(alert())
    await flushPromises()
    await w.find('[data-test="alert-fix-release"]').trigger('click')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="alert-fix-release-error"]').text()).toContain(text)
    expect(w.emitted('changed')).toBeUndefined()
  })

  it('admin non super-admin : gestes désactivés avec explication, liens conservés', async () => {
    seedAuth('ADMIN')
    const w = mountPanel(alert())
    await flushPromises()
    expect((w.find('[data-test="resync-stripe"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.find('[data-test="resync-forbidden"]').exists()).toBe(true)
    expect((w.find('[data-test="alert-fix-release"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.find('[data-test="alert-fix-release-forbidden"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-fix-payment-link"]').exists()).toBe(true)
  })

  it('support sans accès aux paiements : pas de lecture de la fiche, pas de versement', async () => {
    seedAuth('SUPPORT', { PAYMENT_VIEW: false })
    const w = mountPanel(alert())
    await flushPromises()
    expect(paySvc.get).not.toHaveBeenCalled()
    expect(w.find('[data-test="alert-fix-release"]').exists()).toBe(false)
    expect(w.find('[data-test="alert-fix-bid-link"]').exists()).toBe(false)
  })

  it('ancien back (404) : resynchronisation indisponible, le reste de la section demeure', async () => {
    paySvc.resyncStripe.mockRejectedValue({ statusCode: 404, data: {} })
    const w = mountPanel(alert({ paymentId: undefined }))
    await clickResync(w)
    expect(w.find('[data-test="resync-stripe"]').exists()).toBe(false)
    expect(w.find('[data-test="resync-unavailable"]').text()).toContain('Action indisponible sur cet environnement')
    expect(w.find('[data-test="alert-fix-release"]').exists()).toBe(true)
  })

  it.each([
    ['authorization-expired', 'Autorisation carte expirée : il n’y a plus rien à encaisser. Remboursez ou recontactez l’expéditeur'],
    ['stripe-unavailable', 'Stripe injoignable, réessayez'],
  ])('erreur de resynchronisation %s', async (code, text) => {
    paySvc.resyncStripe.mockRejectedValue({ statusCode: 409, data: { code } })
    const w = mountPanel(alert())
    await clickResync(w)
    expect(w.find('[data-test="resync-error"]').text()).toContain(text)
    expect(w.emitted('auto-resolved')).toBeUndefined()
  })

  it('alerte déjà résolue : pas de proposition de résolution', async () => {
    paySvc.resyncStripe.mockResolvedValue(resync({ resolvedAlertIds: [], alertResolvable: true }))
    const w = mountPanel(alert({ resolved: true, resolvedAt: '2026-10-10T09:00:00Z' }))
    await clickResync(w)
    expect(w.find('[data-test="alert-fix-resolve"]').exists()).toBe(false)
  })
})
