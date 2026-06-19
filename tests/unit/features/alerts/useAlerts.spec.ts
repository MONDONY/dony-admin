import { describe, it, expect, vi, beforeEach } from 'vitest'

const { svc } = vi.hoisted(() => ({
  svc: { list: vi.fn(), resolve: vi.fn() }
}))

vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: svc }))

import { useAlerts } from '@/features/alerts/composables/useAlerts'

describe('useAlerts', () => {
  beforeEach(() => { svc.list.mockReset(); svc.resolve.mockReset() })

  it('fetchAlerts loads a page', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'a1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const a = useAlerts()
    await a.fetchAlerts()
    expect(a.alerts.value).toHaveLength(1)
    expect(a.isLoading.value).toBe(false)
  })

  it('setResolvedFilter resets page and refetches', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const a = useAlerts()
    await a.goToPage(2)
    await a.setResolvedFilter('RESOLVED')
    expect(a.currentPage.value).toBe(0)
    expect(a.filters.resolved).toBe('RESOLVED')
  })

  it('resolve calls service and refetches', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    svc.resolve.mockResolvedValue({ id: 'a1', resolved: true })
    const a = useAlerts()
    await a.fetchAlerts()
    svc.list.mockClear()
    await a.resolve('a1', 'ok')
    expect(svc.resolve).toHaveBeenCalledWith('a1', 'ok')
    expect(svc.list).toHaveBeenCalledOnce()
  })

  it('captures errors', async () => {
    svc.list.mockRejectedValue(new Error('boom'))
    const a = useAlerts()
    await a.fetchAlerts()
    expect(a.error.value).toBe('boom')
  })
})
