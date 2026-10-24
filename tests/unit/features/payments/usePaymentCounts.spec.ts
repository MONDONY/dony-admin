import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/payments/services/paymentsService')
import { reactive } from 'vue'
import { usePaymentCounts } from '@/features/payments/composables/usePaymentCounts'
import { paymentsService } from '@/features/payments/services/paymentsService'
import type { PaymentsFilterState, PaymentViewCounts } from '@/features/payments/types/index'
const svc = paymentsService as any

const counts = (all: number): PaymentViewCounts => ({ attention: 1, escrow: 2, releasedRecent: 3, refunded: 4, failed: 5, all, abandoned: 0, alerts: { held: 0, chargebackOpen: 0, mmFailed: 0, escrowJ48: 0 } })
const filters = () => reactive<PaymentsFilterState>({ status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null, held: false, query: '', hideAbandoned: true, view: 'ATTENTION', alert: null, partyId: '', announcementId: '', bidId: '', amountMin: null, amountMax: null })

describe('usePaymentCounts', () => {
  beforeEach(() => { vi.clearAllMocks(); svc.counts = vi.fn() })
  it('reload_fillsCounts', async () => {
    svc.counts.mockResolvedValue(counts(15))
    const f = filters(); const c = usePaymentCounts(f); await c.reload()
    expect(c.counts.value?.all).toBe(15); expect(c.unavailable.value).toBe(false); expect(c.error.value).toBeNull()
    expect(svc.counts).toHaveBeenCalledWith(f)
  })
  it('reload_missingEndpoint_marksUnavailable_noError', async () => {
    svc.counts.mockResolvedValueOnce(counts(15))
    const c = usePaymentCounts(filters()); await c.reload()
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('nf'), { statusCode: 404, data: {} }))
    await c.reload()
    expect(c.unavailable.value).toBe(true); expect(c.counts.value).toBeNull(); expect(c.error.value).toBeNull()
  })
  it('reload_otherError_keepsPreviousCounts_andMessage', async () => {
    svc.counts.mockResolvedValueOnce(counts(15))
    const c = usePaymentCounts(filters()); await c.reload()
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }))
    await c.reload()
    expect(c.counts.value?.all).toBe(15); expect(c.error.value).toBeTruthy(); expect(c.unavailable.value).toBe(false)
  })
  it('reload_ignoresStaleResponse', async () => {
    let resolveFirst!: (_v: unknown) => void
    svc.counts.mockReturnValueOnce(new Promise(r => { resolveFirst = r }))
    svc.counts.mockResolvedValueOnce(counts(2))
    const c = usePaymentCounts(filters())
    const first = c.reload(); const second = c.reload()
    await second; resolveFirst(counts(1)); await first
    expect(c.counts.value?.all).toBe(2)
  })
  it('sync_ignoresViewAlertStatus_reloadsOnScopeFilters', async () => {
    svc.counts.mockResolvedValue(counts(3))
    const f = filters(); const c = usePaymentCounts(f)
    await c.sync(); await c.sync()
    expect(svc.counts).toHaveBeenCalledTimes(1)
    f.view = 'ESCROW'; f.status = 'ESCROW'; f.alert = 'HELD'
    await c.sync()
    expect(svc.counts).toHaveBeenCalledTimes(1)
    let n = 1
    const changes: Array<() => void> = [
      () => { f.query = 'Awa' }, () => { f.currency = 'EUR' }, () => { f.partyId = 'p1' },
      () => { f.method = 'STRIPE' }, () => { f.dateFrom = '2026-10-01' }, () => { f.dateTo = '2026-10-02' },
      () => { f.held = true }, () => { f.hideAbandoned = false }, () => { f.announcementId = 'a1' },
      () => { f.bidId = 'b1' }, () => { f.amountMin = 100 }, () => { f.amountMax = 900 },
    ]
    for (const change of changes) {
      change(); await c.sync(); n++
      expect(svc.counts).toHaveBeenCalledTimes(n)
    }
    await c.reload()
    expect(svc.counts).toHaveBeenCalledTimes(n + 1)
  })
  it('settled_afterFirstAnswer_evenOnError', async () => {
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }))
    const c = usePaymentCounts(filters())
    expect(c.settled.value).toBe(false)
    const p = c.reload()
    expect(c.settled.value).toBe(false)
    await p
    expect(c.settled.value).toBe(true)
  })
  it('sync_retriesAfterError', async () => {
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }))
    svc.counts.mockResolvedValueOnce(counts(9))
    const c = usePaymentCounts(filters())
    await c.sync()
    expect(c.error.value).toBeTruthy()
    await c.sync()
    expect(svc.counts).toHaveBeenCalledTimes(2)
    expect(c.counts.value?.all).toBe(9); expect(c.error.value).toBeNull()
  })
})
