import { describe, it, expect, vi, beforeEach } from 'vitest'

const overview = vi.fn()
vi.mock('@/features/user-profile/services/userProfileService', () => ({
  userProfileService: { overview: (...a: unknown[]) => overview(...a) },
}))

import { useUserOverview } from '@/features/user-profile/composables/useUserOverview'

describe('useUserOverview', () => {
  beforeEach(() => { overview.mockReset() })

  it('charge la synthèse', async () => {
    const data = { kpis: {}, inProgress: [], timeline: [] }
    overview.mockResolvedValue(data)
    const c = useUserOverview('u1')
    const p = c.load()
    expect(c.isLoading.value).toBe(true)
    await p
    expect(overview).toHaveBeenCalledWith('u1')
    expect(c.overview.value).toEqual(data)
    expect(c.isLoading.value).toBe(false)
    expect(c.error.value).toBeNull()
    expect(c.unavailable.value).toBe(false)
  })

  it('404 sans code : unavailable, pas d’erreur', async () => {
    overview.mockRejectedValue({ statusCode: 404 })
    const c = useUserOverview('u1')
    await c.load()
    expect(c.unavailable.value).toBe(true)
    expect(c.error.value).toBeNull()
  })

  it('500 : erreur remplie', async () => {
    overview.mockRejectedValue({ statusCode: 500, data: { detail: 'Boom' } })
    const c = useUserOverview('u1')
    await c.load()
    expect(c.error.value).toBe('Boom')
    expect(c.unavailable.value).toBe(false)
  })

  it('404 avec code : erreur, pas unavailable', async () => {
    overview.mockRejectedValue({ statusCode: 404, data: { code: 'user-not-found', detail: 'Utilisateur introuvable' } })
    const c = useUserOverview('u1')
    await c.load()
    expect(c.error.value).toBe('Utilisateur introuvable')
    expect(c.unavailable.value).toBe(false)
  })

  it('erreur sans message : texte par défaut', async () => {
    overview.mockRejectedValue({ statusCode: 500 })
    const c = useUserOverview('u1')
    await c.load()
    expect(c.error.value).toBe('Impossible de charger la synthèse')
  })
})
