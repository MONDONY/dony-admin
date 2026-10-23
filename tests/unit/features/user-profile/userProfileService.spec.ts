import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { userProfileService, normalizeOverview } from '@/features/user-profile/services/userProfileService'

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

  it('overview() remet à null toutes les clés omises par le back (JSON NON_NULL)', async () => {
    apiMock.mockResolvedValue({ kpis: { parcelsInProgress: 0, openDisputes: 2 } })
    const res = await userProfileService.overview('u1')
    expect(res.kpis).toEqual({
      parcelsInProgress: 0, activeTrips: null, heldByCurrency: null, openDisputes: 2, totalDisputes: null,
      reportsReceived: null, reportsSent: null, reportsPending: null, averageRating: null, ratingCount: null,
    })
    expect(res.inProgress).toBeNull()
    expect(res.timeline).toBeNull()
  })

  it('normalizeOverview garde les valeurs présentes (zéro, listes vides) et tolère une réponse vide', () => {
    const full = normalizeOverview({ kpis: { heldByCurrency: [], averageRating: 0 } as never, inProgress: [], timeline: [] })
    expect(full.kpis.heldByCurrency).toEqual([])
    expect(full.kpis.averageRating).toBe(0)
    expect(full.inProgress).toEqual([])
    expect(full.timeline).toEqual([])
    const empty = normalizeOverview(undefined)
    expect(empty.kpis.parcelsInProgress).toBeNull()
    expect(empty.inProgress).toBeNull()
  })
})
