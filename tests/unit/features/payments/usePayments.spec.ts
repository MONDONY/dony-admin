import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/payments/services/paymentsService')
import { usePayments } from '@/features/payments/composables/usePayments'
import { paymentsService } from '@/features/payments/services/paymentsService'
const svc = paymentsService as any

describe('usePayments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn()
  })
  it('fetchPayments loads page', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'p1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const p = usePayments(); await p.fetchPayments()
    expect(p.payments.value).toHaveLength(1)
  })
  it('setStatusFilter resets page', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = usePayments(); await p.goToPage(2); await p.setStatusFilter('ESCROW')
    expect(p.currentPage.value).toBe(0); expect(p.filters.status).toBe('ESCROW')
  })
  it('captures errors', async () => {
    const err = new Error('x')
    svc.list.mockRejectedValue(err)
    const p = usePayments()
    await p.fetchPayments()
    expect(p.error.value).toBe('x')
  })

  it('setMethodFilter réinitialise la page et filtre par méthode', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = usePayments()
    await p.goToPage(3)
    await p.setMethodFilter('STRIPE')
    expect(p.currentPage.value).toBe(0)
    expect(p.filters.method).toBe('STRIPE')
    expect(svc.list).toHaveBeenCalled()
  })

  it('setDateRange réinitialise la page et applique les dates', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = usePayments()
    await p.goToPage(2)
    await p.setDateRange('2026-01-01', '2026-12-31')
    expect(p.currentPage.value).toBe(0)
    expect(p.filters.dateFrom).toBe('2026-01-01')
    expect(p.filters.dateTo).toBe('2026-12-31')
    expect(svc.list).toHaveBeenCalled()
  })

  it('setDateRange accepte des valeurs null (réinitialisation des dates)', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = usePayments()
    await p.setDateRange(null, null)
    expect(p.filters.dateFrom).toBeNull()
    expect(p.filters.dateTo).toBeNull()
  })
})
