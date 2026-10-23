import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { userProfileService } from '@/features/user-profile/services/userProfileService'

describe('userProfileService', () => {
  beforeEach(() => { apiMock.mockReset() })

  it('overview() appelle GET /admin/users/{id}/overview', async () => {
    apiMock.mockResolvedValue({ kpis: {}, inProgress: null, timeline: null })
    await userProfileService.overview('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/overview')
  })

  it('section() envoie page et size', async () => {
    apiMock.mockResolvedValue({ content: [], totalPages: 0, number: 2, totalElements: 0 })
    await userProfileService.section('u1', 'payments', 2, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/payments', { query: { page: 2, size: 20 } })
  })

  it('section() ajoute les paramètres extra', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await userProfileService.section('u1', 'reports', 0, 10, { direction: 'SENT' })
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/reports', { query: { page: 0, size: 10, direction: 'SENT' } })
  })

  it('encode l’identifiant dans le chemin', async () => {
    apiMock.mockResolvedValue({})
    await userProfileService.overview('a/b')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/a%2Fb/overview')
    await userProfileService.section('a/b', 'audit', 0, 20)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/users/a%2Fb/audit', { query: { page: 0, size: 20 } })
  })
})
