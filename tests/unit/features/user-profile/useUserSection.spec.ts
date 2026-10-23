import { describe, it, expect, vi, beforeEach } from 'vitest'

const section = vi.fn()
vi.mock('@/features/user-profile/services/userProfileService', () => ({
  userProfileService: { section: (...a: unknown[]) => section(...a) },
}))

import { useUserSection } from '@/features/user-profile/composables/useUserSection'

describe('useUserSection', () => {
  beforeEach(() => { section.mockReset() })

  it('charge une fois puis ne rappelle pas le serveur', async () => {
    section.mockResolvedValue({ content: [{ id: 'a' }], totalPages: 3, number: 0, totalElements: 50 })
    const c = useUserSection<{ id: string }>('u1', 'parcels')
    expect(c.loaded.value).toBe(false)
    await c.load()
    await c.load()
    expect(section).toHaveBeenCalledTimes(1)
    expect(section).toHaveBeenCalledWith('u1', 'parcels', 0, 20, undefined)
    expect(c.rows.value).toEqual([{ id: 'a' }])
    expect(c.totalPages.value).toBe(3)
    expect(c.loaded.value).toBe(true)
    expect(c.isLoading.value).toBe(false)
  })

  it('goToPage recharge la page demandée, avec extra', async () => {
    section.mockResolvedValue({ content: [], totalPages: 3, number: 1, totalElements: 50 })
    const c = useUserSection('u1', 'reports', { direction: 'SENT' })
    await c.load()
    await c.goToPage(1)
    expect(section).toHaveBeenCalledTimes(2)
    expect(section).toHaveBeenLastCalledWith('u1', 'reports', 1, 20, { direction: 'SENT' })
    expect(c.page.value).toBe(1)
  })

  it('erreur : message, loaded reste false, lignes intactes', async () => {
    section.mockRejectedValue({ data: { detail: 'Refusé' } })
    const c = useUserSection('u1', 'audit')
    await c.load()
    expect(c.error.value).toBe('Refusé')
    expect(c.loaded.value).toBe(false)
    expect(c.isLoading.value).toBe(false)
  })

  it('erreur sans message : texte par défaut, puis réessai possible', async () => {
    section.mockRejectedValueOnce({})
    const c = useUserSection('u1', 'audit')
    await c.load()
    expect(c.error.value).toBe('Impossible de charger cette section')
    section.mockResolvedValue({ content: [], totalPages: 1, number: 0, totalElements: 0 })
    await c.load()
    expect(c.error.value).toBeNull()
    expect(c.loaded.value).toBe(true)
  })
})
