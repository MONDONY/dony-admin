import { describe, it, expect, vi, beforeEach } from 'vitest'

const svc = vi.hoisted(() => ({ resyncStripe: vi.fn() }))
vi.mock('@/features/payments/services/paymentsService', () => ({ paymentsService: svc }))

import { resetStripeResyncAvailability, useStripeResync } from '@/features/payments/composables/useStripeResync'

const RESULT = {
  paymentId: 'p1', paymentIntentId: 'pi_1', action: 'ALREADY_IN_SYNC', changed: false,
  before: { status: 'ESCROW', capturedAt: null, stripeStatus: 'succeeded', amountCapturable: 0 },
  after: { status: 'ESCROW', capturedAt: null, stripeStatus: 'succeeded', amountCapturable: 0 },
  message: 'ok', resolvedAlertIds: [], openAlertIds: [], alertResolvable: false,
}

describe('useStripeResync', () => {
  beforeEach(() => { svc.resyncStripe.mockReset(); resetStripeResyncAvailability() })

  it('succès : résultat exposé', async () => {
    svc.resyncStripe.mockResolvedValue(RESULT)
    const r = useStripeResync()
    expect(await r.resync('p1')).toEqual(RESULT)
    expect(r.result.value).toEqual(RESULT)
    expect(r.busy.value).toBe(false)
    r.reset()
    expect(r.result.value).toBeNull()
  })

  it('appels concurrents : un seul appel au serveur', async () => {
    let done!: (_v: unknown) => void
    svc.resyncStripe.mockReturnValue(new Promise(res => { done = res }))
    const r = useStripeResync()
    const first = r.resync('p1')
    expect(r.busy.value).toBe(true)
    expect(await r.resync('p1')).toBeNull()
    done(RESULT)
    await first
    expect(svc.resyncStripe).toHaveBeenCalledTimes(1)
  })

  it('ancien back (404 sans code) : indisponible, partagé entre instances, sans message d’erreur', async () => {
    svc.resyncStripe.mockRejectedValue({ statusCode: 404, data: {} })
    const a = useStripeResync()
    expect(await a.resync('p1')).toBeNull()
    expect(a.unavailable.value).toBe(true)
    expect(a.error.value).toBeNull()
    expect(useStripeResync().unavailable.value).toBe(true)
  })

  it('erreur métier : message français', async () => {
    svc.resyncStripe.mockRejectedValue({ statusCode: 502, data: { code: 'stripe-unavailable' } })
    const r = useStripeResync()
    await r.resync('p1')
    expect(r.error.value).toBe('Stripe injoignable, réessayez dans quelques instants.')
    expect(r.unavailable.value).toBe(false)
  })
})
