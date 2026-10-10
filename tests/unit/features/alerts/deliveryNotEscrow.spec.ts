/**
 * Back MONDONY/yadony-back#488 : alerte DELIVERY_NOT_ESCROW_<paymentId>, préfixe court
 * COMMISSION_3DS_UNCONF_<id>, action de resynchronisation ESCROW_RELEASED et champ `released`.
 * Ancien back (sans `released`, ancien préfixe 3DS) : inchangé.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import type { AdminAlert } from '@/features/alerts/types/index'

const alertsSvc = vi.hoisted(() => ({ violations: vi.fn() }))
vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: alertsSvc }))
const paySvc = vi.hoisted(() => ({ get: vi.fn(), resyncStripe: vi.fn(), forceRelease: vi.fn() }))
vi.mock('@/features/payments/services/paymentsService', () => ({ paymentsService: paySvc }))

import AlertDetailPanel from '@/features/alerts/components/AlertDetailPanel.vue'
import StripeResyncPanel from '@/features/payments/components/StripeResyncPanel.vue'
import { resetStripeResyncAvailability } from '@/features/payments/composables/useStripeResync'
import { alertGuide } from '@/features/alerts/lib/alertCatalog'
import { alertPaymentId, isStripeFixAlert, resyncActionLabel } from '@/features/payments/lib/stripeResync'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="JSON.stringify(to)"><slot /></a>' }
const P = '11111111-2222-3333-4444-555555555555'

const alert = (over: Partial<AdminAlert> = {}): AdminAlert => ({
  id: 'a9', type: `DELIVERY_NOT_ESCROW_${P}`, severity: 'CRITICAL', detail: 'Livré hors séquestre', payload: {},
  resolved: false, resolvedAt: null, createdAt: '2026-10-10T04:30:00', paymentId: null, ...over,
})
const payment = (over: Record<string, unknown> = {}) => ({
  id: P, bidId: null, status: 'PENDING', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR',
  createdAt: '2026-10-07T10:00:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false,
  capturedAt: null, insight: null, ...over,
})
const resync = (over: Record<string, unknown> = {}) => ({
  paymentId: P, paymentIntentId: 'pi_1', action: 'ESCROW_RELEASED', changed: true,
  before: { status: 'PENDING', capturedAt: null, stripeStatus: 'requires_capture', amountCapturable: 6450 },
  after: { status: 'RELEASED', capturedAt: '2026-10-10T08:00:00Z', stripeStatus: 'succeeded', amountCapturable: 0 },
  message: null, resolvedAlertIds: [], openAlertIds: [], alertResolvable: false, released: true, ...over,
})

describe('alertes du back #488', () => {
  beforeEach(() => {
    seedAuth('SUPER_ADMIN')
    resetStripeResyncAvailability()
    paySvc.get.mockReset().mockResolvedValue(payment())
    paySvc.resyncStripe.mockReset()
  })

  it('catalogue : DELIVERY_NOT_ESCROW_ et les deux préfixes 3DS', () => {
    const g = alertGuide(`DELIVERY_NOT_ESCROW_${P}`)
    expect(g.title).toBe('Colis livré, paiement pas en séquestre')
    expect(g.actions[0]).toContain('Resynchronisez avec Stripe')
    expect(g.actions[0]).toContain('part automatiquement')
    expect(g.actions[1]).toContain('vérifiez le paiement dans Stripe')
    const short = alertGuide('COMMISSION_3DS_UNCONF_abc')
    const legacy = alertGuide('COMMISSION_3DS_UNCONFIRMED_abc')
    expect(short.title).toBe('Commission payée mais acceptation non finalisée')
    expect(short).toEqual(legacy)
  })

  it('« Corriger » actif : paiement lu dans le suffixe du type', () => {
    expect(isStripeFixAlert(`DELIVERY_NOT_ESCROW_${P}`)).toBe(true)
    expect(alertPaymentId(alert())).toBe(P)
    expect(alertPaymentId(alert({ type: 'DELIVERY_NOT_ESCROW_../../x' }))).toBeNull()
  })

  it('libellé ESCROW_RELEASED', () => {
    expect(resyncActionLabel('ESCROW_RELEASED')).toBe('Colis déjà livré : versement envoyé au voyageur')
  })

  it('fiche d’alerte : resynchroniser, versement parti, « Versé au voyageur »', async () => {
    paySvc.resyncStripe.mockResolvedValue(resync())
    const w = mount(AlertDetailPanel, { props: { alert: alert() }, global: { stubs: { NuxtLink } } })
    await flushPromises()
    expect(w.find('[data-test="alert-fix"]').exists()).toBe(true)
    await w.find('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="resync-action"]').text()).toBe('Colis déjà livré : versement envoyé au voyageur')
    expect(w.find('[data-test="resync-released"]').text()).toBe('Versé au voyageur')
    expect(w.find('[data-test="alert-fix-released"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-fix-release"]').exists()).toBe(false)
  })

  it('ancien back (sans `released`) : rien de plus affiché', async () => {
    const r = resync({ action: 'ESCROW_CAPTURED', released: undefined, after: { status: 'ESCROW', capturedAt: null, stripeStatus: 'succeeded', amountCapturable: 0 } })
    paySvc.resyncStripe.mockResolvedValue(r)
    const w = mount(StripeResyncPanel, { props: { paymentId: P, currency: 'EUR' } })
    await w.find('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="resync-released"]').exists()).toBe(false)
  })
})
