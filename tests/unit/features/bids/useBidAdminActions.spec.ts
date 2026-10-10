import { describe, it, expect, vi, beforeEach } from 'vitest'

const svc = vi.hoisted(() => ({ cancelBid: vi.fn(), openDispute: vi.fn() }))
vi.mock('@/features/bids/services/bidsAdminService', () => ({ bidsAdminService: svc }))

import { useBidAdminActions, resetBidActionsAvailability } from '@/features/bids/composables/useBidAdminActions'

const ID = '1c1a0000-0000-4000-8000-0000000000b2'
const cancelled = { bidId: ID, status: 'CANCELLED', previousStatus: 'ACCEPTED', alreadyCancelled: false, refundRequested: true,
  paymentStatus: 'ESCROW', refundAmount: 48, currency: 'EUR', parcelWithTraveler: false }

describe('useBidAdminActions', () => {
  beforeEach(() => { svc.cancelBid.mockReset(); svc.openDispute.mockReset(); resetBidActionsAvailability() })

  it('annulation réussie : message de succès, note épurée', async () => {
    svc.cancelBid.mockResolvedValue(cancelled)
    const a = useBidAdminActions()
    expect(await a.cancel(ID, 'OTHER', '  Doublon signalé  ')).toBe(true)
    expect(svc.cancelBid).toHaveBeenCalledWith(ID, 'OTHER', 'Doublon signalé')
    expect(a.success.value).toContain('Colis annulé.')
    expect(a.busy.value).toBe(false)
  })

  it('double clic : un seul appel', async () => {
    let resolve!: (_v: unknown) => void
    svc.cancelBid.mockReturnValue(new Promise(r => { resolve = r }))
    const a = useBidAdminActions()
    const first = a.cancel(ID, 'DUPLICATE', '')
    expect(await a.cancel(ID, 'DUPLICATE', '')).toBe(false)
    resolve(cancelled)
    expect(await first).toBe(true)
    expect(svc.cancelBid).toHaveBeenCalledTimes(1)
  })

  it('refus métier : message traduit, l’action reste disponible', async () => {
    svc.cancelBid.mockRejectedValue({ statusCode: 409, data: { code: 'bid-delivered' } })
    const a = useBidAdminActions()
    expect(await a.cancel(ID, 'DUPLICATE', '')).toBe(false)
    expect(a.error.value).toBe('Colis déjà livré : il ne peut plus être annulé.')
    expect(a.cancelUnavailable.value).toBe(false)
    a.reset()
    expect(a.error.value).toBeNull()
  })

  it('ancien back (404 sans code) : action retenue indisponible pour la session', async () => {
    svc.cancelBid.mockRejectedValue({ statusCode: 404 })
    svc.openDispute.mockRejectedValue({ statusCode: 405 })
    const a = useBidAdminActions()
    await a.cancel(ID, 'DUPLICATE', '')
    await a.openDispute(ID, 'SENDER', 'PARCEL_LOST', 'Colis introuvable')
    expect(useBidAdminActions().cancelUnavailable.value).toBe(true)
    expect(useBidAdminActions().disputeUnavailable.value).toBe(true)
  })

  it('litige ouvert : succès ; refus traduit ; double clic ignoré', async () => {
    svc.openDispute.mockResolvedValueOnce({ disputeId: 'd', bidId: ID, type: 'ADMIN_PARCEL_LOST', status: 'OPEN',
      openedOnBehalfOf: 'SENDER', payoutFrozen: true, paymentStatus: 'ESCROW' })
    const a = useBidAdminActions()
    expect(await a.openDispute(ID, 'SENDER', 'PARCEL_LOST', ' Colis introuvable ')).toBe(true)
    expect(svc.openDispute).toHaveBeenCalledWith(ID, 'SENDER', 'PARCEL_LOST', 'Colis introuvable')
    expect(a.success.value).toContain('gelé')

    svc.openDispute.mockRejectedValueOnce({ statusCode: 409, data: { code: 'payment-already-released' } })
    expect(await a.openDispute(ID, 'SENDER', 'PARCEL_LOST', 'Colis introuvable')).toBe(false)
    expect(a.error.value).toContain('ne peut plus geler')

    let resolve!: (_v: unknown) => void
    svc.openDispute.mockReturnValueOnce(new Promise(r => { resolve = r }))
    const p = a.openDispute(ID, 'SENDER', 'PARCEL_LOST', 'Colis introuvable')
    expect(await a.openDispute(ID, 'SENDER', 'PARCEL_LOST', 'Colis introuvable')).toBe(false)
    resolve({ disputeId: 'd', bidId: ID, type: 'ADMIN_PARCEL_LOST', status: 'OPEN', openedOnBehalfOf: 'SENDER', payoutFrozen: false, paymentStatus: null })
    await p
  })
})
