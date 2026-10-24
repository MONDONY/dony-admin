import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/finance/services/financeService')
import { useWalletRefunds } from '@/features/finance/composables/useWalletRefunds'
import { financeService } from '@/features/finance/services/financeService'
const svc = financeService as any

const R = 'eeeeeeee-1111-4222-8333-444444444444'
const page = (content: object[] = []) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const req = (id: string, over: object = {}) => ({ id, userId: 'u1', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-17T10:00:00', channel: 'MANUAL_ADMIN', ...over })
const ALL = ['PENDING', 'PROCESSING', 'FAILED', 'REFUNDED', 'RESOLVED']

beforeEach(() => {
  vi.clearAllMocks()
  svc.listWalletRefundRequests = vi.fn().mockResolvedValue(page([req(R)]))
  svc.resolveWalletRefundRequest = vi.fn().mockResolvedValue({})
  svc.getWalletRefundRetryPreview = vi.fn().mockResolvedValue({ requestId: R, amountDue: 477 })
  svc.retryWalletRefundRequest = vi.fn().mockResolvedValue({})
})

describe('useWalletRefunds', () => {
  it('des tickets attendent : vue À traiter (PENDING) à l’ouverture', async () => {
    const w = useWalletRefunds({ pendingCount: async () => 3 })
    await w.load({})
    expect(w.filters.view).toBe('pending')
    expect(svc.listWalletRefundRequests).toHaveBeenCalledWith(0, 20, ['PENDING'])
    expect(w.applyUrl({ tab: 'wallet-refunds' })).toEqual({ tab: 'wallet-refunds', view: 'pending' })
  })
  it('aucun ticket, ou nombre inconnu (ancien back) : toutes les demandes', async () => {
    for (const n of [0, null]) {
      svc.listWalletRefundRequests.mockClear()
      const w = useWalletRefunds({ pendingCount: async () => n })
      await w.load({})
      expect(w.filters.view).toBe('all')
      expect(svc.listWalletRefundRequests).toHaveBeenCalledWith(0, 20, ALL)
    }
  })
  it('la vue de l’URL gagne, sans demander le nombre', async () => {
    const pendingCount = vi.fn(async () => 3)
    const w = useWalletRefunds({ pendingCount })
    await w.load({ view: 'failed' })
    expect(w.filters.view).toBe('failed')
    expect(pendingCount).not.toHaveBeenCalled()
  })
  it('?open=<demande> : vue Toutes, ligne ouverte', async () => {
    const w = useWalletRefunds({ pendingCount: async () => 3 })
    await w.load({ open: R })
    expect(w.filters.view).toBe('all')
    expect(w.openId.value).toBe(R)
    expect(w.applyUrl({})).toEqual({ open: R })
  })
  it('page ouverte : le lien vers la demande parente l’ouvre (vue Toutes)', async () => {
    const w = useWalletRefunds({ pendingCount: async () => 3 })
    await w.load({})
    await w.syncFromQuery({ tab: 'wallet-refunds', open: R })
    expect(w.openId.value).toBe(R)
    expect(w.filters.view).toBe('all')
    expect(svc.listWalletRefundRequests).toHaveBeenLastCalledWith(0, 20, ALL)
  })
  it('Marquer remboursée : envoie la saisie, ferme, relit la liste et prévient la page', async () => {
    const onChanged = vi.fn()
    const w = useWalletRefunds({ pendingCount: async () => 0, onChanged })
    await w.load({})
    w.openResolve(R)
    expect(w.resolving.value?.id).toBe(R)
    await w.resolve({ paidAmount: 480, note: 'Wave' })
    expect(svc.resolveWalletRefundRequest).toHaveBeenCalledWith(R, { paidAmount: 480, note: 'Wave' })
    expect(w.resolving.value).toBeNull()
    expect(svc.listWalletRefundRequests).toHaveBeenCalledTimes(2)
    expect(onChanged).toHaveBeenCalledTimes(1)
  })
  it('Marquer remboursée refusée : l’erreur reste dans la fenêtre, Annuler la ferme', async () => {
    svc.resolveWalletRefundRequest.mockRejectedValue({ data: { detail: 'Déjà traitée' } })
    const w = useWalletRefunds({ pendingCount: async () => 0 })
    await w.load({})
    w.openResolve(R)
    await w.resolve({})
    expect(w.resolveError.value).toBe('Déjà traitée')
    expect(w.resolving.value?.id).toBe(R)
    w.closeResolve()
    expect(w.resolving.value).toBeNull()
  })
  it('Relancer : aperçu lu, envoi, ligne « En cours », relecture', async () => {
    const onChanged = vi.fn()
    const w = useWalletRefunds({ pendingCount: async () => 0, onChanged })
    await w.load({})
    await w.openRetry(R)
    expect(w.retryPreview.value).toMatchObject({ amountDue: 477 })
    let release: (_v: unknown) => void = () => {}
    svc.listWalletRefundRequests.mockImplementationOnce(() => new Promise((r) => { release = r }))
    const done = w.retry({ amount: 477 })
    await Promise.resolve(); await Promise.resolve()
    expect(w.rows.value[0].status).toBe('PROCESSING')
    release(page([req(R, { status: 'PROCESSING' })]))
    await done
    expect(w.retrying.value).toBeNull()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })
  it('Relancer : un aperçu refusé s’affiche, un envoi refusé garde la fenêtre', async () => {
    svc.getWalletRefundRetryPreview.mockRejectedValueOnce({ data: { detail: 'Non éligible' } })
    svc.retryWalletRefundRequest.mockRejectedValue({ data: { detail: 'Wallet trop bas' } })
    const w = useWalletRefunds({ pendingCount: async () => 0 })
    await w.load({})
    await w.openRetry(R)
    expect(w.retryPreviewError.value).toBe('Non éligible')
    await w.loadRetryPreview()
    expect(w.retryPreviewError.value).toBeNull()
    await w.retry({ amount: 477 })
    expect(w.retryError.value).toBe('Wallet trop bas')
    expect(w.retrying.value?.id).toBe(R)
    w.closeRetry()
    expect(w.retrying.value).toBeNull()
  })
})
