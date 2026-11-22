import { describe, it, expect, vi, beforeEach } from 'vitest'
import { feeOf } from './cancellationFee.fixtures'

const svc = vi.hoisted(() => ({ getCancellationFee: vi.fn(), waiveCancellationFee: vi.fn(), retryCancellationFeePayout: vi.fn() }))
vi.mock('@/features/payments/services/paymentsService', () => ({ paymentsService: svc }))
import { useCancellationFee } from '@/features/payments/composables/useCancellationFee'

describe('useCancellationFee', () => {
  beforeEach(() => Object.values(svc).forEach(f => f.mockReset()))

  it('charge la retenue du colis', async () => {
    svc.getCancellationFee.mockResolvedValue(feeOf())
    const c = useCancellationFee()
    await c.load('bid-1')
    expect(c.fee.value).toEqual(feeOf())
    expect(c.loadError.value).toBeNull()
  })
  it('sans colis : rien n’est appelé, pas de carte', async () => {
    const c = useCancellationFee()
    await c.load(null)
    expect(svc.getCancellationFee).not.toHaveBeenCalled()
    expect(c.fee.value).toBeNull()
  })
  it('404 : pas de carte, pas d’erreur', async () => {
    svc.getCancellationFee.mockResolvedValue(null)
    const c = useCancellationFee()
    await c.load('bid-1')
    expect(c.fee.value).toBeNull()
    expect(c.loadError.value).toBeNull()
  })
  it('erreur de lecture : message discret, sans exception', async () => {
    svc.getCancellationFee.mockRejectedValue({ statusCode: 500, data: { detail: 'Service indisponible' } })
    const c = useCancellationFee()
    await expect(c.load('bid-1')).resolves.toBeUndefined()
    expect(c.loadError.value).toBe('Service indisponible')
    expect(c.fee.value).toBeNull()
  })
  it('erreur de lecture sans détail : repli français', async () => {
    svc.getCancellationFee.mockRejectedValue({})
    const c = useCancellationFee()
    await c.load('bid-1')
    expect(c.loadError.value).toBe('Impossible de charger les frais d’annulation.')
  })
  it('une réponse tardive d’un autre colis ne réécrit rien', async () => {
    let slow!: (_v: unknown) => void
    svc.getCancellationFee.mockReturnValueOnce(new Promise(r => { slow = r })).mockResolvedValueOnce(feeOf({ id: 'fee-2', bidId: 'bid-2' }))
    const c = useCancellationFee()
    const first = c.load('bid-1')
    await c.load('bid-2')
    slow(feeOf())
    await first
    expect(c.fee.value?.id).toBe('fee-2')
  })
  it('renoncer : envoie le motif rogné, remplace la retenue puis la relit', async () => {
    svc.getCancellationFee.mockResolvedValueOnce(feeOf())
    const c = useCancellationFee()
    await c.load('bid-1')
    svc.waiveCancellationFee.mockResolvedValue(feeOf({ status: 'NOT_APPLICABLE', waivable: false }))
    svc.getCancellationFee.mockResolvedValueOnce(feeOf({ status: 'NOT_APPLICABLE', waivable: false, updatedAt: '2026-11-21T09:00:00' }))
    expect(await c.waive('  motif suffisant  ')).toBe(true)
    expect(svc.waiveCancellationFee).toHaveBeenCalledWith('bid-1', 'motif suffisant')
    expect(svc.getCancellationFee).toHaveBeenCalledTimes(2)
    expect(c.fee.value?.status).toBe('NOT_APPLICABLE')
    expect(c.fee.value?.updatedAt).toBe('2026-11-21T09:00:00')
    expect(c.notice.value).toContain('intégral')
    expect(c.busy.value).toBe(false)
  })
  it('relancer : appelle la retenue par son id', async () => {
    svc.getCancellationFee.mockResolvedValue(feeOf({ status: 'PAYOUT_PENDING', waivable: false, payoutRetryable: true }))
    const c = useCancellationFee()
    await c.load('bid-1')
    svc.retryCancellationFeePayout.mockResolvedValue(feeOf({ status: 'PAID_OUT', waivable: false }))
    expect(await c.retryPayout('motif suffisant')).toBe(true)
    expect(svc.retryCancellationFeePayout).toHaveBeenCalledWith('fee-1', 'motif suffisant')
    expect(c.notice.value).toContain('relancé')
  })
  it('relecture en échec : la réponse du geste reste affichée', async () => {
    svc.getCancellationFee.mockResolvedValueOnce(feeOf())
    const c = useCancellationFee()
    await c.load('bid-1')
    svc.waiveCancellationFee.mockResolvedValue(feeOf({ status: 'NOT_APPLICABLE', waivable: false }))
    svc.getCancellationFee.mockRejectedValueOnce({ statusCode: 500 })
    expect(await c.waive('motif suffisant')).toBe(true)
    expect(c.fee.value?.status).toBe('NOT_APPLICABLE')
    expect(c.actionError.value).toBeNull()
  })
  it('409 : le détail du back est affiché tel quel, la retenue ne bouge pas', async () => {
    svc.getCancellationFee.mockResolvedValue(feeOf())
    const c = useCancellationFee()
    await c.load('bid-1')
    svc.waiveCancellationFee.mockRejectedValue({ statusCode: 409, data: { code: 'cancellation-fee-not-due', detail: 'Cette retenue n’est plus due.' } })
    expect(await c.waive('motif suffisant')).toBe(false)
    expect(c.actionError.value).toBe('Cette retenue n’est plus due.')
    expect(c.fee.value?.status).toBe('DUE')
    expect(c.notice.value).toBeNull()
    c.clearAction()
    expect(c.actionError.value).toBeNull()
  })
  it('jamais deux envois en même temps', async () => {
    svc.getCancellationFee.mockResolvedValue(feeOf())
    const c = useCancellationFee()
    await c.load('bid-1')
    let done!: (_v: unknown) => void
    svc.waiveCancellationFee.mockReturnValue(new Promise(r => { done = r }))
    const first = c.waive('motif suffisant')
    expect(c.busy.value).toBe(true)
    expect(await c.waive('motif suffisant')).toBe(false)
    done(feeOf({ status: 'NOT_APPLICABLE', waivable: false }))
    await first
    expect(svc.waiveCancellationFee).toHaveBeenCalledTimes(1)
  })
  it('refresh sans retenue : rien', async () => {
    const c = useCancellationFee()
    await c.refresh()
    expect(svc.getCancellationFee).not.toHaveBeenCalled()
  })
})
