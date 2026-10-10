import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const svc = vi.hoisted(() => ({ resyncStripe: vi.fn() }))
vi.mock('@/features/payments/services/paymentsService', () => ({ paymentsService: svc }))

import StripeResyncPanel from '@/features/payments/components/StripeResyncPanel.vue'
import { resetStripeResyncAvailability } from '@/features/payments/composables/useStripeResync'

function result(over: Record<string, unknown> = {}) {
  return {
    paymentId: 'p1', paymentIntentId: 'pi_1', action: 'ESCROW_CAPTURED', changed: true,
    before: { status: 'ESCROW', capturedAt: null, stripeStatus: 'requires_capture', amountCapturable: 6450 },
    after: { status: 'ESCROW', capturedAt: '2026-10-10T08:00:00Z', stripeStatus: 'succeeded', amountCapturable: 0 },
    message: 'Séquestre capturé sur le solde plateforme', resolvedAlertIds: [], openAlertIds: [], alertResolvable: false,
    ...over,
  }
}

const mountPanel = (paymentId = 'p1') => mount(StripeResyncPanel, { props: { paymentId, currency: 'EUR' } })

describe('StripeResyncPanel', () => {
  beforeEach(() => { seedAuth('SUPER_ADMIN'); svc.resyncStripe.mockReset(); resetStripeResyncAvailability() })

  it('affiche l’action traduite, le message et le tableau avant / après', async () => {
    svc.resyncStripe.mockResolvedValue(result())
    const w = mountPanel()
    expect(w.find('[data-test="resync-stripe"]').text()).toBe('Resynchroniser avec Stripe')
    await w.find('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    expect(svc.resyncStripe).toHaveBeenCalledWith('p1')
    expect(w.find('[data-test="resync-action"]').text()).toBe('Séquestre encaissé : le voyageur pourra être payé')
    expect(w.find('[data-test="resync-message"]').text()).toBe('Séquestre capturé sur le solde plateforme')
    expect(w.find('[data-test="resync-row-status"]').text()).toContain('Sous séquestre')
    const captured = w.find('[data-test="resync-row-captured"]').findAll('td')
    expect(captured[0]!.text()).toBe('Non encaissé')
    expect(captured[1]!.text()).toMatch(/2026/)
    expect(w.find('[data-test="resync-row-stripe"]').text()).toContain('Autorisé, non encaissé (requires_capture)')
    expect(w.find('[data-test="resync-row-capturable"]').text()).toContain('64,50 EUR')
    expect(w.emitted('done')![0]).toEqual([result()])
  })

  it.each([
    ['ALREADY_IN_SYNC', 'Déjà à jour, rien à faire'],
    ['ESCROW_ACTIVATED', 'Paiement passé en séquestre et encaissé'],
    ['CAPTURE_RECORDED', 'Encaissement Stripe enregistré chez Yadony'],
    ['MARKED_FAILED', 'Paiement marqué échoué'],
    ['MARKED_CANCELLED', 'Paiement marqué annulé'],
  ])('action %s', async (action, label) => {
    svc.resyncStripe.mockResolvedValue(result({
      action, changed: action !== 'ALREADY_IN_SYNC', message: null,
      before: { status: 'PENDING', capturedAt: null, stripeStatus: null, amountCapturable: null },
    }))
    const w = mountPanel()
    await w.find('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="resync-action"]').text()).toContain(label)
    expect(w.find('[data-test="resync-message"]').exists()).toBe(false)
    expect(w.find('[data-test="resync-row-capturable"]').findAll('td')[0]!.text()).toBe('—')
    expect(w.find('[data-test="resync-row-stripe"]').findAll('td')[0]!.text()).toBe('—')
  })

  it('statut inconnu ou absent rendu sans planter', async () => {
    svc.resyncStripe.mockResolvedValue(result({ before: { status: null, capturedAt: null, stripeStatus: null, amountCapturable: null }, after: { status: 'NEW', capturedAt: null, stripeStatus: null, amountCapturable: null } }))
    const w = mountPanel()
    await w.find('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    const cells = w.find('[data-test="resync-row-status"]').findAll('td')
    expect(cells[0]!.text()).toBe('—')
    expect(cells[1]!.text()).toBe('NEW')
  })

  it.each([
    [409, 'authorization-expired', 'Autorisation carte expirée'],
    [409, 'amount-mismatch', 'montant ou la devise'],
    [409, 'escrow-capture-failed', 'Stripe a refusé l’encaissement'],
    [409, 'resync-not-supported', 'ne sait pas corriger seule'],
    [422, 'payment-intent-not-found', 'PaymentIntent introuvable'],
    [422, 'not-a-card-payment', 'pas un paiement carte'],
    [404, 'payment-not-found', 'Paiement introuvable'],
    [502, 'stripe-unavailable', 'Stripe injoignable, réessayez'],
  ])('erreur %i %s', async (statusCode, code, text) => {
    svc.resyncStripe.mockRejectedValue({ statusCode, data: { code } })
    const w = mountPanel()
    await w.find('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="resync-error"]').text()).toContain(text)
    expect(w.find('[data-test="resync-stripe"]').exists()).toBe(true)
  })

  it('ancien back (404 sans code) : bouton masqué, action indisponible', async () => {
    svc.resyncStripe.mockRejectedValue({ statusCode: 404, data: {} })
    const w = mountPanel()
    await w.find('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="resync-stripe"]').exists()).toBe(false)
    expect(w.find('[data-test="resync-unavailable"]').text()).toContain('Action indisponible sur cet environnement')
    expect(w.find('[data-test="resync-error"]').exists()).toBe(false)
  })

  it('double clic : bouton en chargement, un seul appel', async () => {
    let done!: (_v: unknown) => void
    svc.resyncStripe.mockReturnValue(new Promise(res => { done = res }))
    const w = mountPanel()
    const btn = w.find('[data-test="resync-stripe"]')
    await btn.trigger('click')
    expect(btn.text()).toBe('Resynchronisation…')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    await btn.trigger('click')
    done(result())
    await flushPromises()
    expect(svc.resyncStripe).toHaveBeenCalledTimes(1)
  })

  it('admin non super-admin : bouton désactivé avec explication', async () => {
    seedAuth('ADMIN')
    const w = mountPanel()
    expect((w.find('[data-test="resync-stripe"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.find('[data-test="resync-forbidden"]').text()).toContain('Réservé aux super-administrateurs')
  })

  it('changement de paiement : résultat effacé', async () => {
    svc.resyncStripe.mockResolvedValue(result())
    const w = mountPanel()
    await w.find('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    await w.setProps({ paymentId: 'p2' })
    expect(w.find('[data-test="resync-result"]').exists()).toBe(false)
  })
})
