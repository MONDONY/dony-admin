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

  it('réponses dans le désordre : seule la dernière requête compte', async () => {
    let resolveOld!: (_v: unknown) => void
    let resolveNew!: (_v: unknown) => void
    section.mockReturnValueOnce(new Promise(r => { resolveOld = r }))
    section.mockReturnValueOnce(new Promise(r => { resolveNew = r }))
    const c = useUserSection<{ id: string }>('u1', 'parcels')
    const old = c.goToPage(2)
    const recent = c.goToPage(3)
    resolveNew({ content: [{ id: 'new' }], totalPages: 5, number: 3, totalElements: 90 })
    await recent
    expect(c.isLoading.value).toBe(false)
    resolveOld({ content: [{ id: 'old' }], totalPages: 4, number: 2, totalElements: 70 })
    await old
    expect(c.rows.value).toEqual([{ id: 'new' }])
    expect(c.page.value).toBe(3)
    expect(c.totalPages.value).toBe(5)
    expect(c.isLoading.value).toBe(false)
  })

  it('une ancienne requête en erreur ne touche pas l’état, ni isLoading', async () => {
    let rejectOld!: (_e: unknown) => void
    let resolveNew!: (_v: unknown) => void
    section.mockReturnValueOnce(new Promise((_, rej) => { rejectOld = rej }))
    section.mockReturnValueOnce(new Promise(r => { resolveNew = r }))
    const c = useUserSection('u1', 'parcels')
    const old = c.goToPage(1)
    const recent = c.goToPage(2)
    rejectOld({ data: { detail: 'Tard' } })
    await old
    expect(c.error.value).toBeNull()
    expect(c.isLoading.value).toBe(true)
    resolveNew({ content: [], totalPages: 3, number: 2, totalElements: 0 })
    await recent
    expect(c.isLoading.value).toBe(false)
  })

  it('reload() recharge la page courante', async () => {
    section.mockResolvedValue({ content: [], totalPages: 3, number: 1, totalElements: 0 })
    const c = useUserSection('u1', 'parcels')
    await c.goToPage(1)
    await c.reload()
    expect(section).toHaveBeenCalledTimes(2)
    expect(section).toHaveBeenLastCalledWith('u1', 'parcels', 1, 20, undefined)
  })
})
