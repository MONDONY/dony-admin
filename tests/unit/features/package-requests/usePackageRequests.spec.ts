import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/package-requests/services/packageRequestsService', () => ({
  packageRequestsService: { list: vi.fn(), get: vi.fn(), remove: vi.fn(), restore: vi.fn() },
}))
import { usePackageRequests } from '@/features/package-requests/composables/usePackageRequests'
import { packageRequestsService } from '@/features/package-requests/services/packageRequestsService'
const svc = vi.mocked(packageRequestsService)

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id, senderId: 's1', senderName: 'Awa', departureCity: 'Paris', arrivalCity: 'Dakar', desiredDate: '2026-10-01',
  weightKg: 4, parcelSize: 'SMALL', transportMode: 'PLANE', status: 'OPEN', currency: 'EUR', targetPrice: 40,
  createdAt: '2026-09-20T10:00:00Z', reportCount: 0, openNegotiationCount: 1, ...over,
})
const page = (content: unknown[], totalPages = 1, number = 0) => ({ content, totalElements: content.length, totalPages, number, size: 20 }) as never

describe('usePackageRequests', () => {
  beforeEach(() => vi.clearAllMocks())

  it('load lit la première page avec les filtres par défaut', async () => {
    svc.list.mockResolvedValue(page([item('p1')], 3))
    const s = usePackageRequests()
    await s.load()
    expect(svc.list).toHaveBeenCalledWith({ status: 'ALL', query: '', reportedOnly: false, from: null, to: null }, 0, 20)
    expect(s.requests.value.map((r) => r.id)).toEqual(['p1'])
    expect(s.totalPages.value).toBe(3)
    expect(s.isLoading.value).toBe(false)
    expect(s.unavailable.value).toBe(false)
  })

  it('goToPage charge la page demandée', async () => {
    svc.list.mockResolvedValueOnce(page([item('p1')], 3)).mockResolvedValueOnce(page([item('p2')], 3, 2))
    const s = usePackageRequests()
    await s.load()
    await s.goToPage(2)
    expect(svc.list).toHaveBeenLastCalledWith(expect.anything(), 2, 20)
    expect(s.currentPage.value).toBe(2)
  })

  it('un échec de page garde la page affichée et montre le detail du ProblemDetail', async () => {
    svc.list.mockResolvedValueOnce(page([item('p1')], 3))
      .mockRejectedValueOnce(Object.assign(new Error('[GET] 500'), { statusCode: 500, data: { detail: 'Erreur serveur' } }))
    const s = usePackageRequests()
    await s.load()
    await s.goToPage(1)
    expect(s.currentPage.value).toBe(0)
    expect(s.requests.value.map((r) => r.id)).toEqual(['p1'])
    expect(s.error.value).toBe('Erreur serveur')
  })

  it('chaque filtre repart de la page 0', async () => {
    svc.list.mockResolvedValue(page([item('p1')], 5, 0))
    const s = usePackageRequests()
    await s.load()
    await s.goToPage(3)
    await s.setStatus('REMOVED_BY_ADMIN')
    expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'REMOVED_BY_ADMIN' }), 0, 20)
    await s.goToPage(2)
    await s.setReportedOnly(true)
    expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ reportedOnly: true }), 0, 20)
    await s.setDateRange('2026-09-01', null)
    expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-09-01', to: null }), 0, 20)
    await s.setQuery('  Dakar ')
    expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'Dakar' }), 0, 20)
    expect(s.currentPage.value).toBe(0)
  })

  it('une recherche identique ne relance pas la requête', async () => {
    svc.list.mockResolvedValue(page([]))
    const s = usePackageRequests()
    await s.setQuery('Dakar')
    await s.setQuery(' Dakar ')
    expect(svc.list).toHaveBeenCalledTimes(1)
  })

  it('ancien back (404 sans code) : indisponible, sans erreur rouge', async () => {
    svc.list.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404, data: { detail: 'No endpoint' } }))
    const s = usePackageRequests()
    await s.load()
    expect(s.unavailable.value).toBe(true)
    expect(s.error.value).toBeNull()
  })

  it('un 404 porteur d’un code reste une erreur', async () => {
    svc.list.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404, data: { code: 'x', detail: 'Introuvable' } }))
    const s = usePackageRequests()
    await s.load()
    expect(s.unavailable.value).toBe(false)
    expect(s.error.value).toBe('Introuvable')
  })

  it('sans detail, message de repli', async () => {
    svc.list.mockRejectedValue({})
    const s = usePackageRequests()
    await s.load()
    expect(s.error.value).toBe('Impossible de charger les demandes d’envoi')
  })

  it('replace met à jour la ligne concernée sans recharger', async () => {
    svc.list.mockResolvedValue(page([item('p1'), item('p2')]))
    const s = usePackageRequests()
    await s.load()
    s.replace({ ...item('p2'), status: 'REMOVED_BY_ADMIN', openNegotiationCount: 0, description: 'x' } as never)
    expect(s.requests.value[1]).toMatchObject({ status: 'REMOVED_BY_ADMIN', openNegotiationCount: 0 })
    expect(s.requests.value[1]).not.toHaveProperty('description')
    s.replace(item('absent') as never)
    expect(s.requests.value).toHaveLength(2)
    expect(svc.list).toHaveBeenCalledTimes(1)
  })
})
