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
  it('refund calls service + refreshes + returns true', async () => {
    svc.get.mockResolvedValue({ id: 'p1', status: 'ESCROW' })
    svc.refund.mockResolvedValue({ id: 'p1', status: 'REFUNDED' })
    const d = usePaymentDetail(); await d.open('p1')
    const ok = await d.refund()
    expect(ok).toBe(true)
    expect(d.payment.value?.status).toBe('REFUNDED')
    expect(d.error.value).toBeNull()
  })
  it('refund failure sets error and returns false', async () => {
    svc.get.mockResolvedValue({ id: 'p1', status: 'ESCROW' })
    svc.refund.mockRejectedValue(new Error('Impossible de rembourser'))
    const d = usePaymentDetail(); await d.open('p1')
    const ok = await d.refund()
    expect(ok).toBe(false)
    expect(d.error.value).toBe('Impossible de rembourser')
  })
  it('close clears payment and error', async () => {
    svc.get.mockResolvedValue({ id: 'p1', status: 'ESCROW' })
    const d = usePaymentDetail(); await d.open('p1')
    d.close()
    expect(d.payment.value).toBeNull()
    expect(d.error.value).toBeNull()
  })
})
