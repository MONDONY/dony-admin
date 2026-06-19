import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/promo/services/promoService')
import { usePromoCodes } from '@/features/promo/composables/usePromoCodes'
import { promoService } from '@/features/promo/services/promoService'
const svc = promoService as any

const INPUT = { code: 'X', type: 'PERCENT', value: 10, maxRedemptions: null, expiresAt: null, active: true }

describe('usePromoCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    svc.create = vi.fn().mockResolvedValue({ id: 'p1' })
    svc.update = vi.fn().mockResolvedValue({ id: 'p1' })
    svc.remove = vi.fn().mockResolvedValue(undefined)
  })

  it('fetchCodes loads page', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'p1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const p = usePromoCodes()
    await p.fetchCodes()
    expect(p.codes.value).toHaveLength(1)
  })

  it('setActiveFilter resets page', async () => {
    const p = usePromoCodes()
    await p.goToPage(2)
    await p.setActiveFilter(false)
    expect(p.currentPage.value).toBe(0)
    expect(p.filters.active).toBe(false)
  })

  it('create calls service then refetches', async () => {
    const p = usePromoCodes()
    await p.create(INPUT)
    expect(svc.create).toHaveBeenCalledWith(INPUT)
    expect(svc.list).toHaveBeenCalled()
  })

  it('update calls service then refetches', async () => {
    const p = usePromoCodes()
    await p.update('p1', INPUT)
    expect(svc.update).toHaveBeenCalledWith('p1', INPUT)
    expect(svc.list).toHaveBeenCalled()
  })

  it('remove calls service then refetches', async () => {
    const p = usePromoCodes()
    await p.remove('p1')
    expect(svc.remove).toHaveBeenCalledWith('p1')
    expect(svc.list).toHaveBeenCalled()
  })

  it('captures errors', async () => {
    svc.list.mockRejectedValue(new Error('promo boom'))
    const p = usePromoCodes()
    await p.fetchCodes()
    expect(p.error.value).toBe('promo boom')
  })
})
