/**
 * Back MONDONY/yadony-back#488 : alerte LATE_RELEASE_FAILED_<paymentId> (CRITICAL), colis livré,
 * séquestre en place, versement automatique en échec. Payload : paymentId, bidId, amount,
 * currency, reason, source ; `AdminAlertResponse.paymentId` renseigné.
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
import { resetStripeResyncAvailability } from '@/features/payments/composables/useStripeResync'
import { alertFacts, alertGuide, alertSummary } from '@/features/alerts/lib/alertCatalog'
import { alertPaymentId, isStripeFixAlert } from '@/features/payments/lib/stripeResync'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="JSON.stringify(to)"><slot /></a>' }
const P = '11111111-2222-3333-4444-555555555555'
const B = '66666666-7777-8888-9999-000000000000'
const REASON = 'versement refusé par Stripe (insufficient funds)'

const payload = { paymentId: P, bidId: B, amount: '64.50', currency: 'EUR', reason: REASON, source: 'late-escrow' }
const alert = (over: Partial<AdminAlert> = {}): AdminAlert => ({
  id: 'a10', type: `LATE_RELEASE_FAILED_${P}`, severity: 'CRITICAL', detail: null, payload,
  resolved: false, resolvedAt: null, createdAt: '2026-10-10T04:30:00', paymentId: P, ...over,
})
const payment = (over: Record<string, unknown> = {}) => ({
  id: P, bidId: B, status: 'ESCROW', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR',
  createdAt: '2026-10-07T10:00:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false,
  capturedAt: '2026-10-08T10:00:00', insight: null, ...over,
})

describe('alerte LATE_RELEASE_FAILED_ (back #488)', () => {
  beforeEach(() => {
    seedAuth('SUPER_ADMIN')
    resetStripeResyncAvailability()
    paySvc.get.mockReset().mockResolvedValue(payment())
    paySvc.resyncStripe.mockReset()
  })

  it('catalogue : titre, explication et trois étapes', () => {
    const g = alertGuide(`LATE_RELEASE_FAILED_${P}`)
    expect(g.title).toBe('Colis livré, versement automatique impossible')
    expect(g.category).toBe('Versement voyageur')
    expect(g.explanation).toContain('paiement est en séquestre')
    expect(g.explanation).toContain('a échoué')
    expect(g.explanation).toContain('« Motif »')
    expect(g.explanation).toContain('« Origine »')
    expect(g.actions).toHaveLength(3)
    expect(g.actions[0]).toContain('voyageur gelé')
    expect(g.actions[0]).toContain('compte Stripe du voyageur inutilisable')
    expect(g.actions[0]).toContain('encaissement de la carte refusé')
    expect(g.actions[0]).toContain('virement refusé')
    expect(g.actions[1]).toContain('termine son compte Stripe')
    expect(g.actions[2]).toContain('Resynchroniser avec Stripe')
    expect(g.actions[2]).toContain('Forcer le versement au voyageur')
    expect(g.actions[2]).toContain('se ferme d’elle-même')
  })

  it('résumé : la phrase du back, sinon le motif du payload', () => {
    expect(alertSummary(alert({ detail: 'Phrase du back' }))).toBe('Phrase du back')
    expect(alertSummary(alert())).toBe(`Versement automatique impossible : ${REASON}`)
    expect(alertSummary(alert({ payload: { amount: '64.50', currency: 'EUR' } }))).toBe('Montant : 64.50 EUR')
  })

  it('données : motif et origine libellés', () => {
    const facts = alertFacts(alert())
    expect(facts.find(f => f.key === 'reason')).toMatchObject({ label: 'Motif', value: REASON })
    expect(facts.find(f => f.key === 'source')).toMatchObject({ label: 'Origine', value: 'late-escrow' })
  })

  it('« Corriger » actif : paiement lu dans paymentId, sinon dans le suffixe du type', () => {
    expect(isStripeFixAlert(`LATE_RELEASE_FAILED_${P}`)).toBe(true)
    expect(alertPaymentId(alert())).toBe(P)
    expect(alertPaymentId(alert({ paymentId: null, payload: {} }))).toBe(P)
    expect(alertPaymentId(alert({ type: 'LATE_RELEASE_FAILED_../../x', paymentId: null, payload: {} }))).toBeNull()
  })

  it('fiche d’alerte : titre, motif, section « Corriger » et forçage proposé', async () => {
    const w = mount(AlertDetailPanel, { props: { alert: alert() }, global: { stubs: { NuxtLink } } })
    await flushPromises()
    expect(w.find('[data-test="alert-detail-title"]').text()).toBe('Colis livré, versement automatique impossible')
    expect(w.find('[data-test="alert-detail-summary"]').text()).toContain(REASON)
    expect(w.find('[data-test="alert-fix"]').exists()).toBe(true)
    expect(w.find('[data-test="resync-stripe"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-fix-release"]').exists()).toBe(true)
  })
})
