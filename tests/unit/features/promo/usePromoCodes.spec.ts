import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/promo/services/promoService')
import { usePromoCodes } from '@/features/promo/composables/usePromoCodes'
import { promoService } from '@/features/promo/services/promoService'
const svc = promoService as any

const INPUT = {
  code: 'X', rate: 0.1, target: 'ANY' as const,
  validFrom: null, validTo: null, maxRedemptions: null, perUserLimit: 1,
}

function makeCode(id: string, status: 'ACTIVE' | 'DISABLED' = 'ACTIVE') {
  return {
    id, code: id.toUpperCase(), rate: 0.1, target: 'ANY', validFrom: null, validTo: null,
    maxRedemptions: null, perUserLimit: 1, redeemedCount: 0, status, createdAt: '2026-01-01T00:00:00',
  }
}

describe('usePromoCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn().mockResolvedValue([])
    svc.create = vi.fn().mockResolvedValue({ id: 'p1' })
    svc.update = vi.fn().mockResolvedValue({ id: 'p1' })
    svc.setStatus = vi.fn().mockResolvedValue({ id: 'p1' })
    svc.remove = vi.fn().mockResolvedValue(undefined)
  })

  it('fetchCodes loads the list', async () => {
    svc.list.mockResolvedValue([makeCode('p1')])
    const p = usePromoCodes()
    await p.fetchCodes()
    expect(p.codes.value).toHaveLength(1)
  })

  it('setStatusFilter filters client-side and resets page', async () => {
    svc.list.mockResolvedValue([makeCode('p1', 'ACTIVE'), makeCode('p2', 'DISABLED')])
    const p = usePromoCodes()
    await p.fetchCodes()
    p.goToPage(2)
    p.setStatusFilter('DISABLED')
    expect(p.currentPage.value).toBe(0)
    expect(p.codes.value).toHaveLength(1)
    expect(p.codes.value[0].id).toBe('p2')
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

  it('setStatus calls service then refetches', async () => {
    const p = usePromoCodes()
    await p.setStatus('p1', 'DISABLED')
    expect(svc.setStatus).toHaveBeenCalledWith('p1', 'DISABLED')
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
