import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/signalements/services/reportsService')
import { useReports } from '@/features/signalements/composables/useReports'
import { reportsService } from '@/features/signalements/services/reportsService'
const svc = reportsService as any

describe('useReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn()
    svc.resolve = vi.fn()
    svc.remove = vi.fn()
    svc.bulkDelete = vi.fn()
  })

  it('fetchReports loads page', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'r1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const r = useReports()
    await r.fetchReports()
    expect(r.reports.value).toHaveLength(1)
    expect(r.totalPages.value).toBe(1)
  })

  it('setStatusFilter resets page and reloads', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const r = useReports()
    await r.goToPage(3)
    await r.setStatusFilter('RESOLVED')
    expect(r.currentPage.value).toBe(0)
    expect(r.filters.status).toBe('RESOLVED')
  })

  it('setTargetTypeFilter updates filter and reloads', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const r = useReports()
    await r.setTargetTypeFilter('ANNOUNCEMENT')
    expect(r.filters.targetType).toBe('ANNOUNCEMENT')
    expect(r.currentPage.value).toBe(0)
  })

  it('resolve : appelle le service et met la ligne à jour sur place, sans recharger', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'r1', status: 'OPEN', actionTaken: null, availableActions: ['RESOLVE', 'DISMISS'] }, { id: 'r2', status: 'OPEN' }], totalElements: 2, totalPages: 1, number: 0, size: 20 })
    svc.resolve.mockResolvedValue({ id: 'r1', status: 'RESOLVED', actionTaken: 'RESOLVE' })
    const r = useReports()
    await r.fetchReports()
    svc.list.mockClear()
    const ok = await r.resolve('r1', 'RESOLVE', '')
    expect(ok).toBe(true)
    expect(svc.resolve).toHaveBeenCalledWith('r1', 'RESOLVE', '')
    expect(svc.list).not.toHaveBeenCalled()
    expect(r.reports.value[0]).toMatchObject({ id: 'r1', status: 'RESOLVED', actionTaken: 'RESOLVE', availableActions: [] })
    expect(r.reports.value[1]).toMatchObject({ id: 'r2', status: 'OPEN' })
    expect(r.lastResolved.value).toMatchObject({ id: 'r1', status: 'RESOLVED' })
    expect(r.resolveError.value).toBeNull()
  })

  it('resolve : réponse sans corps exploitable, on retombe sur l’action envoyée', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'r1', status: 'OPEN', actionTaken: null }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    svc.resolve.mockResolvedValue(undefined)
    const r = useReports()
    await r.fetchReports()
    await r.resolve('r1', 'DISMISS', '')
    expect(r.reports.value[0]).toMatchObject({ status: 'DISMISSED', actionTaken: 'DISMISS', availableActions: [] })
  })

  it('resolve 403 : detail affiché, ligne inchangée', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'r1', status: 'OPEN' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    svc.resolve.mockRejectedValue(Object.assign(new Error('403 Forbidden'), { statusCode: 403, data: { status: 403, detail: 'Permission USER_SUSPEND requise' } }))
    const r = useReports()
    await r.fetchReports()
    const ok = await r.resolve('r1', 'SUSPEND_AUTHOR', 'menaces')
    expect(ok).toBe(false)
    expect(r.resolveError.value).toBe('Permission USER_SUSPEND requise')
    expect(r.reports.value[0].status).toBe('OPEN')
  })

  it('resolve 403 sans detail : message français', async () => {
    svc.resolve.mockRejectedValue(Object.assign(new Error('403 Forbidden'), { statusCode: 403, data: {} }))
    const r = useReports()
    await r.resolve('r1', 'DELETE_MESSAGE', 'x')
    expect(r.resolveError.value).toBe('Vous n’avez pas la permission d’appliquer cette action.')
  })

  it('resolve 422 report-target-unresolvable : detail du back, ou message français à défaut', async () => {
    svc.resolve.mockRejectedValueOnce(Object.assign(new Error('422'), { statusCode: 422, data: { code: 'report-target-unresolvable', detail: 'Message introuvable' } }))
    const r = useReports()
    await r.resolve('r1', 'DELETE_MESSAGE', 'x')
    expect(r.resolveError.value).toBe('Message introuvable')
    svc.resolve.mockRejectedValueOnce(Object.assign(new Error('422 Unprocessable Entity'), { statusCode: 422, data: { code: 'report-target-unresolvable' } }))
    await r.resolve('r1', 'DELETE_MESSAGE', 'x')
    expect(r.resolveError.value).toBe('La cible de ce signalement est introuvable : elle a peut-être déjà été supprimée.')
  })

  it('ancien back qui refuse RESOLVE : detail affiché, pas d’exception', async () => {
    svc.resolve.mockRejectedValue(Object.assign(new Error('400 Bad Request'), { statusCode: 400, data: { detail: 'Corps de requête illisible' } }))
    const r = useReports()
    await expect(r.resolve('r1', 'RESOLVE', '')).resolves.toBe(false)
    expect(r.resolveError.value).toBe('Corps de requête illisible')
  })

  it('un rechargement efface le message du dernier traitement', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'r1', status: 'OPEN' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    svc.resolve.mockResolvedValue({ id: 'r1', status: 'RESOLVED', actionTaken: 'RESOLVE' })
    const r = useReports()
    await r.fetchReports()
    await r.resolve('r1', 'RESOLVE', '')
    expect(r.lastResolved.value).not.toBeNull()
    await r.setStatusFilter('RESOLVED')
    expect(r.lastResolved.value).toBeNull()
  })

  it('clearResolveFeedback efface erreur et succès', async () => {
    svc.resolve.mockRejectedValue(new Error('boom'))
    const r = useReports()
    await r.resolve('r1', 'RESOLVE', '')
    expect(r.resolveError.value).toBe('boom')
    r.clearResolveFeedback()
    expect(r.resolveError.value).toBeNull()
    expect(r.lastResolved.value).toBeNull()
  })

  it('captures errors', async () => {
    svc.list.mockRejectedValue(new Error('boom'))
    const r = useReports()
    await r.fetchReports()
    expect(r.error.value).toBe('boom')
  })

  it('affiche le detail du ProblemDetail plutôt que le message technique', async () => {
    svc.list.mockRejectedValue(Object.assign(new Error('500 Internal Server Error'), { data: { detail: 'Détail lisible du back' } }))
    const r = useReports()
    await r.fetchReports()
    expect(r.error.value).toBe('Détail lisible du back')
  })

  describe('recherche et sélection (yadony-back #318)', () => {
    const page = (ids: string[], totalElements = ids.length) => ({
      content: ids.map((id) => ({ id })), totalElements, totalPages: Math.ceil(totalElements / 20), number: 0, size: 20,
    })

    it('setQuery normalise, remet la page à 0, vide la sélection et recharge', async () => {
      svc.list.mockResolvedValue(page(['r1', 'r2']))
      const r = useReports()
      await r.fetchReports()
      r.toggleSelect('r1')
      await r.goToPage(2)
      await r.setQuery('  badge ')
      expect(r.filters.q).toBe('badge')
      expect(r.currentPage.value).toBe(0)
      expect(r.selectedIds.value).toEqual([])
      expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'badge' }), 0, 20)
    })

    it('setQuery avec le même texte ne recharge pas', async () => {
      svc.list.mockResolvedValue(page([]))
      const r = useReports()
      await r.setQuery('x')
      const calls = svc.list.mock.calls.length
      await r.setQuery(' x ')
      expect(svc.list.mock.calls.length).toBe(calls)
    })

    it('toggleSelect / togglePage / clearSelection', async () => {
      svc.list.mockResolvedValue(page(['r1', 'r2', 'r3']))
      const r = useReports()
      await r.fetchReports()
      r.toggleSelect('r1')
      expect(r.selectedIds.value).toEqual(['r1'])
      expect(r.selectedCount.value).toBe(1)
      expect(r.pageFullySelected.value).toBe(false)
      r.togglePage()
      expect(r.selectedIds.value).toEqual(['r1', 'r2', 'r3'])
      expect(r.pageFullySelected.value).toBe(true)
      r.togglePage()
      expect(r.selectedIds.value).toEqual([])
      r.toggleSelect('r2')
      r.clearSelection()
      expect(r.selectedIds.value).toEqual([])
    })

    it('« sélectionner tous les résultats » n’est proposé que page entière + résultats hors page', async () => {
      svc.list.mockResolvedValue(page(['r1', 'r2'], 45))
      const r = useReports()
      await r.fetchReports()
      expect(r.canSelectAllResults.value).toBe(false)
      r.togglePage()
      expect(r.canSelectAllResults.value).toBe(true)
      r.selectAllResults()
      expect(r.allResultsSelected.value).toBe(true)
      expect(r.selectedCount.value).toBe(45)
      expect(r.canSelectAllResults.value).toBe(false)
      // Décocher une ligne sort du mode « tous les résultats ».
      r.toggleSelect('r1')
      expect(r.allResultsSelected.value).toBe(false)
      expect(r.selectedCount.value).toBe(1)
    })

    it('sans résultats hors page, pas de proposition', async () => {
      svc.list.mockResolvedValue(page(['r1', 'r2'], 2))
      const r = useReports()
      await r.fetchReports()
      r.togglePage()
      expect(r.canSelectAllResults.value).toBe(false)
    })

    it('deleteSelected par identifiants, puis recharge et vide la sélection', async () => {
      svc.list.mockResolvedValue(page(['r1', 'r2', 'r3']))
      svc.bulkDelete.mockResolvedValue({ deleted: 2 })
      const r = useReports()
      await r.fetchReports()
      r.toggleSelect('r1')
      r.toggleSelect('r3')
      const n = await r.deleteSelected()
      expect(n).toBe(2)
      expect(svc.bulkDelete).toHaveBeenCalledWith({ ids: ['r1', 'r3'] })
      expect(r.selectedIds.value).toEqual([])
      expect(svc.list).toHaveBeenCalledTimes(2)
    })

    it('deleteSelected sur « tous les résultats » passe le filtre courant, pas les ids', async () => {
      svc.list.mockResolvedValue(page(['r1', 'r2'], 45))
      svc.bulkDelete.mockResolvedValue({ deleted: 45 })
      const r = useReports()
      await r.setQuery('bug')
      r.togglePage()
      r.selectAllResults()
      const n = await r.deleteSelected()
      expect(n).toBe(45)
      expect(svc.bulkDelete).toHaveBeenCalledWith({ all: true, filters: expect.objectContaining({ status: 'OPEN', q: 'bug' }) })
      expect(r.allResultsSelected.value).toBe(false)
    })

    it('deleteSelected sans sélection ne fait rien', async () => {
      const r = useReports()
      expect(await r.deleteSelected()).toBe(0)
      expect(svc.bulkDelete).not.toHaveBeenCalled()
    })

    it('une page vidée renvoie à la précédente', async () => {
      svc.list.mockResolvedValue(page(['r1'], 21))
      svc.bulkDelete.mockResolvedValue({ deleted: 1 })
      const r = useReports()
      await r.goToPage(1)
      r.toggleSelect('r1')
      await r.deleteSelected()
      expect(r.currentPage.value).toBe(0)
    })

    it('deleteOne appelle remove, retire l’id de la sélection et recharge', async () => {
      svc.list.mockResolvedValue(page(['r1', 'r2']))
      svc.remove.mockResolvedValue(undefined)
      const r = useReports()
      await r.fetchReports()
      r.toggleSelect('r1')
      r.toggleSelect('r2')
      await r.deleteOne('r1')
      expect(svc.remove).toHaveBeenCalledWith('r1')
      expect(r.selectedIds.value).toEqual(['r2'])
      expect(svc.list).toHaveBeenCalledTimes(2)
    })
  })
})
