import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { gpProService } from '@/features/gp-pro/services/gpProService'

describe('gpProService', () => {
  beforeEach(() => { apiMock.mockReset(); apiMock.mockResolvedValue(undefined) })

  it('listApplications() lit la file PENDING paginée', async () => {
    await gpProService.listApplications(2, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/gp-pro/applications', { query: { status: 'PENDING', page: 2, size: 20 } })
  })

  it('getApplication() lit la fiche', async () => {
    await gpProService.getApplication('a1')
    expect(apiMock).toHaveBeenCalledWith('/admin/gp-pro/applications/a1')
  })

  it('approve() et reject() postent la décision, le refus avec son motif', async () => {
    await gpProService.approve('a1')
    await gpProService.reject('a1', 'Profil trop récent')
    expect(apiMock.mock.calls[0]).toEqual(['/admin/gp-pro/applications/a1/approve', { method: 'POST' }])
    expect(apiMock.mock.calls[1]).toEqual(['/admin/gp-pro/applications/a1/reject', { method: 'POST', body: { reason: 'Profil trop récent' } }])
  })

  it('listReview() et dismissFlag() pour l’onglet « À revoir »', async () => {
    await gpProService.listReview(0, 20)
    await gpProService.dismissFlag('f1')
    expect(apiMock.mock.calls[0]).toEqual(['/admin/gp-pro/review', { query: { page: 0, size: 20 } }])
    expect(apiMock.mock.calls[1]).toEqual(['/admin/gp-pro/review-flags/f1/dismiss', { method: 'POST' }])
  })

  it('grant() envoie la note seulement si elle existe', async () => {
    await gpProService.grant('u1', 'Connu du terrain')
    await gpProService.grant('u1', null)
    expect(apiMock.mock.calls[0]).toEqual(['/admin/users/u1/gp-pro/grant', { method: 'POST', body: { note: 'Connu du terrain' } }])
    expect(apiMock.mock.calls[1]).toEqual(['/admin/users/u1/gp-pro/grant', { method: 'POST', body: {} }])
  })

  it('revoke() envoie le motif', async () => {
    await gpProService.revoke('u1', 'Plusieurs litiges récents')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/gp-pro/revoke', { method: 'POST', body: { reason: 'Plusieurs litiges récents' } })
  })
})
