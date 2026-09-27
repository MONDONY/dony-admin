/**
 * Versements retenus d'un voyageur banni ou dont l'identité est révoquée : filtre de liste,
 * lecture des champs de retenue, et dérogation motivée sur le déblocage forcé et la relance
 * du versement. Un ancien back n'envoie aucun de ces champs : rien ne doit changer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { paymentsService } from '@/features/payments/services/paymentsService'
import {
  PAYOUT_OVERRIDE_REASON_MAX, PAYOUT_OVERRIDE_REASON_MIN, holdReasonLabel, isPaymentHeld, overrideReasonValid,
} from '@/features/payments/types/index'
import { usePaymentDetail } from '@/features/payments/composables/usePaymentDetail'
import { usePayments } from '@/features/payments/composables/usePayments'

const EMPTY_PAGE = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
const baseFilters = { status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null } as const

function conflict(code: string, detail = 'Refus du serveur') {
  return Object.assign(new Error('409 Conflict'), { statusCode: 409, data: { code, detail } })
}

describe('paymentsService : versements retenus', () => {
  beforeEach(() => apiMock.mockReset())

  it('list envoie held=true quand le filtre est actif', async () => {
    apiMock.mockResolvedValue(EMPTY_PAGE)
    await paymentsService.list({ ...baseFilters, held: true }, 0, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ held: 'true', page: 0, size: 20 })
  })

  it('list n’envoie pas held quand le filtre est inactif ou absent', async () => {
    apiMock.mockResolvedValue(EMPTY_PAGE)
    await paymentsService.list({ ...baseFilters, held: false }, 0, 20)
    await paymentsService.list({ ...baseFilters }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.held).toBeUndefined()
    expect(apiMock.mock.calls[1][1].query.held).toBeUndefined()
  })

  it('forceRelease sans dérogation : aucun corps, comme avant', async () => {
    apiMock.mockResolvedValue({ id: 'p1' })
    await paymentsService.forceRelease('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/payments/p1/force-release', { method: 'POST' })
  })

  it('forceRelease avec dérogation : corps overrideHold + motif', async () => {
    apiMock.mockResolvedValue({ id: 'p1' })
    await paymentsService.forceRelease('p1', { overrideHold: true, overrideReason: 'Colis bien livré, vérifié' })
    expect(apiMock).toHaveBeenCalledWith('/admin/payments/p1/force-release', {
      method: 'POST', body: { overrideHold: true, overrideReason: 'Colis bien livré, vérifié' },
    })
  })

  it('retryMobileMoneyPayout avec dérogation : même corps', async () => {
    apiMock.mockResolvedValue({ id: 'p1' })
    await paymentsService.retryMobileMoneyPayout('p1', { overrideHold: true, overrideReason: 'Voyageur réhabilité' })
    expect(apiMock).toHaveBeenCalledWith('/admin/payments/p1/mobile-money/retry-payout', {
      method: 'POST', body: { overrideHold: true, overrideReason: 'Voyageur réhabilité' },
    })
  })
})

describe('types : lecture de la retenue', () => {
  it('isPaymentHeld : bénéficiaire gelé ou date de retenue', () => {
    expect(isPaymentHeld({ beneficiaryHeld: true })).toBe(true)
    expect(isPaymentHeld({ payoutHeldAt: '2026-09-20T10:00:00' })).toBe(true)
    expect(isPaymentHeld({ beneficiaryHeld: false, payoutHeldAt: null })).toBe(false)
    // Ancien back : aucun champ.
    expect(isPaymentHeld({})).toBe(false)
  })

  it('holdReasonLabel traduit le motif, sans jargon', () => {
    expect(holdReasonLabel('BANNED')).toBe('compte banni')
    expect(holdReasonLabel('KYC_REVOKED')).toBe('identité révoquée')
    expect(holdReasonLabel(null)).toBeNull()
    expect(holdReasonLabel(undefined)).toBeNull()
    expect(holdReasonLabel('AUTRE')).toBe('AUTRE')
  })

  it('overrideReasonValid : 10 à 500 caractères après trim', () => {
    expect(PAYOUT_OVERRIDE_REASON_MIN).toBe(10)
    expect(PAYOUT_OVERRIDE_REASON_MAX).toBe(500)
    expect(overrideReasonValid('   court   ')).toBe(false)
    expect(overrideReasonValid('a'.repeat(10))).toBe(true)
    expect(overrideReasonValid('a'.repeat(500))).toBe(true)
    expect(overrideReasonValid('a'.repeat(501))).toBe(false)
  })
})

describe('usePayments : filtre Versements retenus', () => {
  beforeEach(() => apiMock.mockReset())

  it('setHeldFilter active le filtre, revient en page 0 et relit la liste', async () => {
    apiMock.mockResolvedValue({ ...EMPTY_PAGE, content: [{ id: 'p1', payoutHeldAt: '2026-09-20T10:00:00' }] })
    const p = usePayments()
    await p.goToPage(3)
    await p.setHeldFilter(true)
    expect(p.filters.held).toBe(true)
    expect(p.currentPage.value).toBe(0)
    expect(apiMock.mock.calls.at(-1)![1].query.held).toBe('true')
    expect(p.heldFilterUnsupported.value).toBe(false)
  })

  it('ancien back : le filtre est ignoré, la liste revient sans champ de retenue, on le signale', async () => {
    apiMock.mockResolvedValue({ ...EMPTY_PAGE, content: [{ id: 'p1' }, { id: 'p2' }], totalPages: 1 })
    const p = usePayments()
    await p.setHeldFilter(true)
    expect(p.heldFilterUnsupported.value).toBe(true)
    expect(p.payments.value).toEqual([])
  })

  it('filtre inactif : jamais signalé comme non pris en charge', async () => {
    apiMock.mockResolvedValue({ ...EMPTY_PAGE, content: [{ id: 'p1' }] })
    const p = usePayments()
    await p.fetchPayments()
    expect(p.heldFilterUnsupported.value).toBe(false)
    expect(p.payments.value).toHaveLength(1)
  })
})

describe('usePaymentDetail : dérogation', () => {
  beforeEach(() => apiMock.mockReset())

  async function opened() {
    apiMock.mockResolvedValueOnce({ id: 'p1', status: 'ESCROW' })
    const d = usePaymentDetail()
    await d.open('p1')
    return d
  }

  it('cas normal : forceRelease sans corps, aucune demande de dérogation', async () => {
    const d = await opened()
    apiMock.mockResolvedValueOnce({ id: 'p1', status: 'RELEASED' })
    expect(await d.forceRelease()).toBe(true)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/payments/p1/force-release', { method: 'POST' })
    expect(d.overrideRequest.value).toBeNull()
  })

  it('409 payout-beneficiary-held : bascule en dérogation pour ce geste', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(conflict('payout-beneficiary-held'))
    expect(await d.forceRelease()).toBe(false)
    expect(d.overrideRequest.value).toEqual({ action: 'release', code: 'payout-beneficiary-held' })
    expect(d.error.value).toContain('retenu')
  })

  it('409 payment-disputed sur la relance : bascule en dérogation pour la relance', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(conflict('payment-disputed'))
    expect(await d.retryPayout()).toBe(false)
    expect(d.overrideRequest.value).toEqual({ action: 'retry-payout', code: 'payment-disputed' })
    expect(d.error.value).toContain('litige bancaire')
  })

  it('409 stripe-account-unusable : message clair, pas de dérogation', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(conflict('stripe-account-unusable'))
    expect(await d.forceRelease()).toBe(false)
    expect(d.overrideRequest.value).toBeNull()
    expect(d.error.value).toContain('compte Stripe du voyageur')
  })

  it('dérogation envoyée : corps transmis, demande effacée au succès', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(conflict('payout-beneficiary-held'))
    await d.forceRelease()
    apiMock.mockResolvedValueOnce({ id: 'p1', status: 'RELEASED' })
    const override = { overrideHold: true as const, overrideReason: 'Colis livré, contrôlé' }
    expect(await d.forceRelease(override)).toBe(true)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/payments/p1/force-release', { method: 'POST', body: override })
    expect(d.overrideRequest.value).toBeNull()
    expect(d.payment.value?.status).toBe('RELEASED')
  })

  it('relance avec dérogation : corps transmis', async () => {
    const d = await opened()
    apiMock.mockResolvedValueOnce({ id: 'p1', status: 'RELEASED' })
    const override = { overrideHold: true as const, overrideReason: 'Voyageur réhabilité' }
    expect(await d.retryPayout(override)).toBe(true)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/payments/p1/mobile-money/retry-payout', { method: 'POST', body: override })
  })

  it('dismissOverride efface la demande ; close aussi', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(conflict('payout-beneficiary-held'))
    await d.forceRelease()
    d.dismissOverride()
    expect(d.overrideRequest.value).toBeNull()
    apiMock.mockRejectedValueOnce(conflict('payout-beneficiary-held'))
    await d.forceRelease()
    d.close()
    expect(d.overrideRequest.value).toBeNull()
  })

  it('409 d’un autre code sur le remboursement : erreur ordinaire, pas de dérogation', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(conflict('payout-beneficiary-held', 'Détail du back'))
    expect(await d.refund()).toBe(false)
    expect(d.overrideRequest.value).toBeNull()
    expect(d.error.value).toBe('Détail du back')
  })
})

describe('heldPaymentsReminder', () => {
  it('accorde au singulier et au pluriel', async () => {
    const { heldPaymentsReminder } = await import('@/features/payments/types/index')
    expect(heldPaymentsReminder(1)).toContain('1 paiement retenu : il ne repartira pas tout seul')
    expect(heldPaymentsReminder(3)).toContain('3 paiements retenus : ils ne repartiront pas tout seuls')
  })
})
