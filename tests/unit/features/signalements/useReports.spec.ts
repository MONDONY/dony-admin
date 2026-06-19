import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/signalements/services/reportsService')
import { useReports } from '@/features/signalements/composables/useReports'
import { reportsService } from '@/features/signalements/services/reportsService'
const svc = reportsService as any

describe('useReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn()
    svc.resolve = vi.fn()
  })

  it('fetchReports loads page', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'r1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const r = useReports()
    await r.fetchReports()
    expect(r.reports.value).toHaveLength(1)
    expect(r.totalPages.value).toBe(1)
  })

  it('setStatusFilter resets page and reloads', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const r = useReports()
    await r.goToPage(3)
    await r.setStatusFilter('RESOLVED')
    expect(r.currentPage.value).toBe(0)
    expect(r.filters.status).toBe('RESOLVED')
  })

  it('setTargetTypeFilter updates filter and reloads', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const r = useReports()
    await r.setTargetTypeFilter('ANNOUNCEMENT')
    expect(r.filters.targetType).toBe('ANNOUNCEMENT')
    expect(r.currentPage.value).toBe(0)
  })

  it('resolve calls service then refetches', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    svc.resolve.mockResolvedValue({ id: 'r1', status: 'RESOLVED' })
    const r = useReports()
    await r.resolve('r1', 'WARN', 'avertissement')
    expect(svc.resolve).toHaveBeenCalledWith('r1', 'WARN', 'avertissement')
    expect(svc.list).toHaveBeenCalled()
  })

  it('captures errors', async () => {
    svc.list.mockRejectedValue(new Error('boom'))
    const r = useReports()
    await r.fetchReports()
    expect(r.error.value).toBe('boom')
  })
})
