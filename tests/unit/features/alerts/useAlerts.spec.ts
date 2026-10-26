import { describe, it, expect, vi, beforeEach } from 'vitest'

const { svc } = vi.hoisted(() => ({
  svc: { list: vi.fn(), resolve: vi.fn(), resolveBatch: vi.fn(), reopen: vi.fn(), snooze: vi.fn(), unsnooze: vi.fn() }
}))

vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: svc }))

import { useAlerts } from '@/features/alerts/composables/useAlerts'

describe('useAlerts', () => {
  beforeEach(() => { Object.values(svc).forEach(m => m.mockReset()) })

  it('fetchAlerts loads a page', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'a1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const a = useAlerts()
    await a.fetchAlerts()
    expect(a.alerts.value).toHaveLength(1)
    expect(a.isLoading.value).toBe(false)
  })

  it('markResolvedLocally marque résolues les alertes citées, sans recharger', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'a1', resolved: false, resolvedAt: null }, { id: 'a2', resolved: false, resolvedAt: null }, { id: 'a3', resolved: true, resolvedAt: 'old' }], totalElements: 3, totalPages: 1, number: 0, size: 20 })
    const a = useAlerts()
    await a.fetchAlerts()
    a.markResolvedLocally(['a1', 'a3'], '2026-10-10T08:00:00Z')
    expect(a.alerts.value.map(x => [x.id, x.resolved, x.resolvedAt])).toEqual([
      ['a1', true, '2026-10-10T08:00:00Z'], ['a2', false, null], ['a3', true, 'old'],
    ])
    a.markResolvedLocally(['a2'])
    expect(a.alerts.value[1]!.resolvedAt).toEqual(expect.any(String))
    expect(svc.list).toHaveBeenCalledTimes(1)
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

  it('resolveMany : une seule requête de résolution groupée, puis un rechargement ; rend les introuvables', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 })
    svc.resolveBatch.mockResolvedValue({ resolved: ['a1', 'a3'], alreadyResolved: [], notFound: ['a2'] })
    const a = useAlerts()
    const failed = await a.resolveMany(['a1', 'a2', 'a3'], 'Versement forcé')
    expect(svc.resolveBatch).toHaveBeenCalledWith(['a1', 'a2', 'a3'], 'Versement forcé')
    expect(svc.resolve).not.toHaveBeenCalled()
    expect(failed).toEqual(['a2'])
    expect(svc.list).toHaveBeenCalledOnce()
  })

  it('resolveMany : une alerte déjà résolue n’est pas un échec', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 })
    svc.resolveBatch.mockResolvedValue({ resolved: ['a1'], alreadyResolved: ['a2'], notFound: [] })
    expect(await useAlerts().resolveMany(['a1', 'a2'], 'ok ok')).toEqual([])
  })

  it('resolveMany : ancien back (404 sans code) → une requête par alerte, les refusées rendues', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 })
    svc.resolveBatch.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 }))
    svc.resolve.mockImplementation((id: string) => (id === 'a2' ? Promise.reject(new Error('403')) : Promise.resolve({ id, resolved: true })))
    const failed = await useAlerts().resolveMany(['a1', 'a2', 'a3'], 'Versement forcé')
    expect(svc.resolve.mock.calls.map(c => c[0])).toEqual(['a1', 'a2', 'a3'])
    expect(failed).toEqual(['a2'])
    expect(svc.list).toHaveBeenCalledOnce()
  })

  it('resolveMany : un vrai refus du back remonte, la liste est rechargée', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 })
    svc.resolveBatch.mockRejectedValue(Object.assign(new Error('Unprocessable'), { statusCode: 422, data: { code: 'alert-note-invalid' } }))
    await expect(useAlerts().resolveMany(['a1'], 'ab')).rejects.toThrow('Unprocessable')
    expect(svc.resolve).not.toHaveBeenCalled()
    expect(svc.list).toHaveBeenCalledOnce()
  })

  it('reopen, snooze et unsnooze appellent le service puis rechargent la liste', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 })
    const a = useAlerts()
    await a.reopen('a1', 'revenue')
    await a.snooze('a2', 24, 'colis en route')
    await a.unsnooze('a3')
    expect(svc.reopen).toHaveBeenCalledWith('a1', 'revenue')
    expect(svc.snooze).toHaveBeenCalledWith('a2', 24, 'colis en route')
    expect(svc.unsnooze).toHaveBeenCalledWith('a3')
    expect(svc.list).toHaveBeenCalledTimes(3)
  })

  it('une page large garde les groupes entiers', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 })
    const a = useAlerts()
    await a.fetchAlerts()
    expect(svc.list.mock.calls[0]![2]).toBe(100)
  })

  it('captures errors', async () => {
    svc.list.mockRejectedValue(new Error('boom'))
    const a = useAlerts()
    await a.fetchAlerts()
    expect(a.error.value).toBe('boom')
  })

  it('affiche le detail du ProblemDetail plutôt que le message technique', async () => {
    svc.list.mockRejectedValue(Object.assign(new Error('500 Internal Server Error'), { data: { detail: 'Détail lisible du back' } }))
    const a = useAlerts()
    await a.fetchAlerts()
    expect(a.error.value).toBe('Détail lisible du back')
  })
})
