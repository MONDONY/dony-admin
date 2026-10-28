import { describe, it, expect, vi, beforeEach } from 'vitest'

const getApplication = vi.fn()
vi.mock('@/features/gp-pro/services/gpProService', () => ({
  gpProService: { getApplication: (...a: unknown[]) => getApplication(...a) },
}))

import { useGpProList } from '@/features/gp-pro/composables/useGpProList'
import { useGpProAction } from '@/features/gp-pro/composables/useGpProAction'
import { useGpProApplication } from '@/features/gp-pro/composables/useGpProApplication'

const missing = () => ({ statusCode: 404, data: { detail: 'No endpoint matches this path' } })

describe('useGpProList', () => {
  it('charge une page et suit la réponse', async () => {
    const fetch = vi.fn().mockResolvedValue({ content: [{ id: 1 }], totalElements: 41, totalPages: 3, number: 2 })
    const l = useGpProList(fetch, 'Échec')
    await l.goToPage(2)
    expect(fetch).toHaveBeenCalledWith(2, 20)
    expect(l.items.value).toHaveLength(1)
    expect(l.totalElements.value).toBe(41)
    expect(l.totalPages.value).toBe(3)
    expect(l.currentPage.value).toBe(2)
    expect(l.isLoading.value).toBe(false)
  })

  it('tolère une page réduite (ni content, ni compteurs)', async () => {
    const l = useGpProList(vi.fn().mockResolvedValue({}), 'Échec')
    await l.load(1)
    expect(l.items.value).toEqual([])
    expect(l.totalElements.value).toBe(0)
    expect(l.totalPages.value).toBe(0)
    expect(l.currentPage.value).toBe(1)
  })

  it('un échec garde la page précédente et affiche le detail', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ content: [{ id: 1 }], number: 0 })
      .mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Base indisponible' } })
    const l = useGpProList(fetch, 'Échec')
    await l.load(0)
    await l.load(1)
    expect(l.error.value).toBe('Base indisponible')
    expect(l.items.value).toHaveLength(1)
    expect(l.currentPage.value).toBe(0)
  })

  it('ancien back (404 sans code) : indisponible, sans erreur', async () => {
    const l = useGpProList(vi.fn().mockRejectedValue(missing()), 'Échec')
    await l.load()
    expect(l.unavailable.value).toBe(true)
    expect(l.error.value).toBeNull()
  })
})

describe('useGpProAction', () => {
  it('succès : true, sans erreur', async () => {
    const a = useGpProAction()
    expect(await a.run(() => Promise.resolve())).toBe(true)
    expect(a.error.value).toBeNull()
    expect(a.busy.value).toBe(false)
  })

  it('le detail du back prime sur le repli par code', async () => {
    const a = useGpProAction()
    expect(await a.run(() => Promise.reject({ statusCode: 422, data: { code: 'gp-pro-kyc-required', detail: 'KYC requis côté serveur' } }))).toBe(false)
    expect(a.error.value).toBe('KYC requis côté serveur')
  })

  it('sans detail : message français par code, et relecture sur conflit', async () => {
    const onStale = vi.fn()
    const a = useGpProAction({ onStale })
    await a.run(() => Promise.reject({ statusCode: 409, data: { code: 'gp-pro-application-not-pending' } }))
    expect(a.error.value).toBe('Cette demande a déjà été décidée : la file a été relue.')
    expect(onStale).toHaveBeenCalledTimes(1)
    await a.run(() => Promise.reject({ statusCode: 422, data: { code: 'gp-pro-reason-required' } }))
    expect(a.error.value).toBe('Un motif est obligatoire.')
    expect(onStale).toHaveBeenCalledTimes(1)
  })

  it('code inconnu sans detail : repli fourni', async () => {
    const a = useGpProAction()
    await a.run(() => Promise.reject({ statusCode: 500, data: {} }), 'Repli')
    expect(a.error.value).toBe('Repli')
    a.clearError()
    expect(a.error.value).toBeNull()
  })

  it('ancien back : indisponible, sans erreur', async () => {
    const a = useGpProAction()
    expect(await a.run(() => Promise.reject(missing()))).toBe(false)
    expect(a.unavailable.value).toBe(true)
    expect(a.error.value).toBeNull()
  })
})

describe('useGpProApplication', () => {
  beforeEach(() => getApplication.mockReset())

  it('load() puis refresh() : la fiche suit la dernière lecture', async () => {
    getApplication.mockResolvedValueOnce({ applicationId: 'a1', status: 'PENDING' })
      .mockResolvedValueOnce({ applicationId: 'a1', status: 'APPROVED' })
    const d = useGpProApplication()
    await d.load('a1')
    expect(d.detail.value?.status).toBe('PENDING')
    await d.refresh('a1')
    expect(d.detail.value?.status).toBe('APPROVED')
    d.clear()
    expect(d.detail.value).toBeNull()
  })

  it('échec de chargement : fiche vide et message', async () => {
    getApplication.mockRejectedValueOnce({ data: { detail: 'Demande introuvable' } })
    const d = useGpProApplication()
    await d.load('a1')
    expect(d.detail.value).toBeNull()
    expect(d.error.value).toBe('Demande introuvable')
    expect(d.isLoading.value).toBe(false)
  })

  it('échec de relecture : la fiche affichée reste', async () => {
    getApplication.mockResolvedValueOnce({ applicationId: 'a1', status: 'PENDING' }).mockRejectedValueOnce(new Error(''))
    const d = useGpProApplication()
    await d.load('a1')
    await d.refresh('a1')
    expect(d.detail.value?.status).toBe('PENDING')
    expect(d.error.value).toBe('Impossible de relire la demande')
  })
})

describe('useGpProApplication, lectures concurrentes', () => {
  beforeEach(() => getApplication.mockReset())

  it('une réponse tardive d’une lecture plus ancienne est écartée', async () => {
    // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
    let releaseSlow: (v: unknown) => void = () => {}
    getApplication.mockImplementationOnce(() => new Promise((r) => { releaseSlow = r }))
    getApplication.mockResolvedValueOnce({ applicationId: 'b', status: 'PENDING', userId: 'u' })
    const app = useGpProApplication()
    const slow = app.load('a')
    await app.load('b')
    releaseSlow({ applicationId: 'a', status: 'PENDING', userId: 'u' })
    await slow
    expect(app.detail.value?.applicationId).toBe('b')
    expect(app.isLoading.value).toBe(false)
  })

  it('une erreur tardive d’une lecture plus ancienne n’efface pas la fiche affichée', async () => {
    // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
    let failSlow: (e: unknown) => void = () => {}
    getApplication.mockImplementationOnce(() => new Promise((_, rej) => { failSlow = rej }))
    getApplication.mockResolvedValueOnce({ applicationId: 'b', status: 'PENDING', userId: 'u' })
    const app = useGpProApplication()
    const slow = app.load('a')
    await app.load('b')
    failSlow({ statusCode: 500, data: { detail: 'Panne' } })
    await slow
    expect(app.error.value).toBeNull()
    expect(app.detail.value?.applicationId).toBe('b')
  })

  it('refresh : une relecture plus récente l’emporte ; clear écarte une lecture en vol', async () => {
    // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
    let releaseSlow: (v: unknown) => void = () => {}
    getApplication.mockImplementationOnce(() => new Promise((r) => { releaseSlow = r }))
    getApplication.mockResolvedValueOnce({ applicationId: 'a', status: 'APPROVED', userId: 'u' })
    const app = useGpProApplication()
    const slow = app.refresh('a')
    await app.refresh('a')
    releaseSlow({ applicationId: 'a', status: 'PENDING', userId: 'u' })
    await slow
    expect(app.detail.value?.status).toBe('APPROVED')
    getApplication.mockImplementationOnce(() => new Promise((r) => { releaseSlow = r }))
    const pending = app.load('c')
    app.clear()
    releaseSlow({ applicationId: 'c', status: 'PENDING', userId: 'u' })
    await pending
    expect(app.detail.value).toBeNull()
    expect(app.isLoading.value).toBe(false)
  })

  it('refresh en échec ne touche pas une fiche plus récente', async () => {
    // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
    let failSlow: (e: unknown) => void = () => {}
    getApplication.mockImplementationOnce(() => new Promise((_, rej) => { failSlow = rej }))
    getApplication.mockResolvedValueOnce({ applicationId: 'b', status: 'PENDING', userId: 'u' })
    const app = useGpProApplication()
    const slow = app.refresh('a')
    await app.load('b')
    failSlow({ statusCode: 500, data: {} })
    await slow
    expect(app.error.value).toBeNull()
  })
})
