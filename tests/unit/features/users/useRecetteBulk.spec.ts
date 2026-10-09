import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { seedAuth } from '~/tests/helpers/auth'

const getStatus = vi.fn()
const setBulk = vi.fn()
const list = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: {
    getRecetteStatus: (...a: unknown[]) => getStatus(...a),
    setRecetteTesterBulk: (...a: unknown[]) => setBulk(...a),
    list: (...a: unknown[]) => list(...a),
  },
}))

import { bulkSuccessMessage, RECETTE_BULK_MAX, useRecetteBulk } from '@/features/users/composables/useRecetteBulk'

const filters = { status: 'TOUS' as const, role: null, kyc: null, pro: null, city: null, query: '' }

describe('useRecetteBulk', () => {
  beforeEach(() => {
    getStatus.mockReset(); setBulk.mockReset(); list.mockReset()
    seedAuth('SUPER_ADMIN')
  })
  afterEach(() => { vi.useRealTimers() })

  it('sans ADMIN_MANAGE : aucun appel, fonctionnalité cachée', async () => {
    seedAuth('ADMIN')
    const r = useRecetteBulk()
    await r.load()
    expect(getStatus).not.toHaveBeenCalled()
    expect(r.available.value).toBe(false)
  })

  it('super-admin en staging : disponible ; en prod ou back ancien (404) : caché sans erreur', async () => {
    getStatus.mockResolvedValueOnce({ enabled: true })
    const open = useRecetteBulk()
    await open.load()
    expect(open.available.value).toBe(true)

    getStatus.mockResolvedValueOnce({ enabled: false })
    const closed = useRecetteBulk()
    await closed.load()
    expect(closed.available.value).toBe(false)

    getStatus.mockRejectedValueOnce({ statusCode: 404 })
    const old = useRecetteBulk()
    await old.load()
    expect(old.available.value).toBe(false)
    expect(old.feedback.value).toBeNull()
  })

  it('coche, décoche, toute la page puis la dé-sélectionne, efface', () => {
    const r = useRecetteBulk()
    r.toggle('a')
    expect(r.count.value).toBe(1)
    r.toggle('a')
    expect(r.count.value).toBe(0)
    r.toggle('a')
    r.togglePage(['a', 'b', 'c'])
    expect(r.count.value).toBe(3)
    r.togglePage(['a', 'b', 'c'])
    expect(r.count.value).toBe(0)
    r.togglePage(['a'])
    r.clear()
    expect(r.count.value).toBe(0)
  })

  it('sélectionne tous les résultats du filtre en une requête, plafonnée au lot maximal', async () => {
    list.mockResolvedValue({ content: [{ id: 'a' }, { id: 'b' }], totalElements: 350, totalPages: 2, number: 0, size: 200 })
    const r = useRecetteBulk()
    await r.selectAllMatching(filters)
    expect(list).toHaveBeenCalledWith(filters, 0, RECETTE_BULK_MAX)
    expect(r.count.value).toBe(2)
    expect(r.truncated.value).toBe(true)
    r.toggle('c')
    expect(r.truncated.value).toBe(false)
  })

  it('échec de la sélection complète : message, sélection inchangée', async () => {
    list.mockRejectedValue(new Error('boom'))
    const r = useRecetteBulk()
    r.toggle('a')
    await r.selectAllMatching(filters)
    expect(r.count.value).toBe(1)
    expect(r.feedback.value?.tone).toBe('error')
  })

  it('applique, annonce le résultat et vide la sélection', async () => {
    vi.useFakeTimers()
    setBulk.mockResolvedValue({ updated: 12, unchanged: 0, notFound: [] })
    const r = useRecetteBulk()
    r.togglePage(['a', 'b'])
    expect(await r.apply(true)).toBe(true)
    expect(setBulk).toHaveBeenCalledWith(['a', 'b'], true)
    expect(r.feedback.value).toEqual({ tone: 'success', text: '12 comptes passés en mode recette.' })
    expect(r.count.value).toBe(0)
    vi.advanceTimersByTime(6000)
    expect(r.feedback.value).toBeNull()
    r.dispose()
  })

  it('sélection vide : aucun appel', async () => {
    const r = useRecetteBulk()
    expect(await r.apply(true)).toBe(false)
    expect(setBulk).not.toHaveBeenCalled()
  })

  it('409 recette-disabled : message clair, fonctionnalité masquée', async () => {
    getStatus.mockResolvedValue({ enabled: true })
    setBulk.mockRejectedValue({ statusCode: 409, data: { code: 'recette-disabled' } })
    const r = useRecetteBulk()
    await r.load()
    r.toggle('a')
    expect(await r.apply(true)).toBe(false)
    expect(r.available.value).toBe(false)
    expect(r.feedback.value?.text).toMatch(/Mode recette fermé/)
    expect(r.count.value).toBe(1)
  })

  it('422, 403 et autres erreurs : messages distincts', async () => {
    const r = useRecetteBulk()
    r.toggle('a')
    setBulk.mockRejectedValueOnce({ statusCode: 422 })
    await r.apply(false)
    expect(r.feedback.value?.text).toMatch(/entre 1 et 200/)
    setBulk.mockRejectedValueOnce({ statusCode: 403 })
    await r.apply(false)
    expect(r.feedback.value?.text).toMatch(/super-administrateur/)
    setBulk.mockRejectedValueOnce({ statusCode: 500 })
    await r.apply(false)
    expect(r.feedback.value?.tone).toBe('error')
    r.dispose()
  })
})

describe('bulkSuccessMessage', () => {
  it('accorde et détaille', () => {
    expect(bulkSuccessMessage(true, 1, 0, 0)).toBe('1 compte passé en mode recette.')
    expect(bulkSuccessMessage(true, 3, 2, 1)).toBe('3 comptes passés en mode recette (2 déjà testeurs, 1 introuvable).')
    expect(bulkSuccessMessage(false, 2, 1, 2)).toBe('2 comptes retirés du mode recette (1 n’était pas testeur, 2 introuvables).')
    expect(bulkSuccessMessage(false, 0, 3, 0)).toBe('0 compte retiré du mode recette (3 n’étaient pas testeurs).')
    expect(bulkSuccessMessage(true, 0, 1, 0)).toBe('0 compte passé en mode recette (1 déjà testeur).')
  })
})
