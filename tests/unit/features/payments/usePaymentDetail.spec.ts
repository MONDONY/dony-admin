import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/payments/services/paymentsService')
import { usePaymentDetail } from '@/features/payments/composables/usePaymentDetail'
import { paymentsService } from '@/features/payments/services/paymentsService'
const svc = paymentsService as any

describe('usePaymentDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.get = vi.fn()
    svc.forceRelease = vi.fn()
    svc.refund = vi.fn()
  })
  it('open loads payment', async () => {
    svc.get.mockResolvedValue({ id: 'p1', status: 'ESCROW' })
    const d = usePaymentDetail(); await d.open('p1')
    expect(d.payment.value?.id).toBe('p1')
  })
  it('forceRelease calls service + refreshes', async () => {
    svc.get.mockResolvedValue({ id: 'p1', status: 'ESCROW' })
    svc.forceRelease.mockResolvedValue({ id: 'p1', status: 'RELEASED' })
    const d = usePaymentDetail(); await d.open('p1'); await d.forceRelease()
    expect(d.payment.value?.status).toBe('RELEASED')
  })
  it('refund calls service + refreshes', async () => {
    svc.get.mockResolvedValue({ id: 'p1', status: 'ESCROW' })
    svc.refund.mockResolvedValue({ id: 'p1', status: 'REFUNDED' })
    const d = usePaymentDetail(); await d.open('p1'); await d.refund()
    expect(d.payment.value?.status).toBe('REFUNDED')
  })
})
