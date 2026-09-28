import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/signalements/services/reportsService')
import { useReports } from '@/features/signalements/composables/useReports'
import { reportsService } from '@/features/signalements/services/reportsService'
const svc = reportsService as unknown as Record<string, ReturnType<typeof vi.fn>>

const deletedRow = (id: string) => ({ id, deletedAt: '2026-09-20T10:00:00Z', deletedByAdminEmail: 'mod@yadony.com' })
const page = (content: unknown[], totalElements = content.length) => ({ content, totalElements, totalPages: 1, number: 0, size: 20 })
const missing = () => Object.assign(new Error('404'), { statusCode: 404, data: {} })

describe('useReports : filtre Supprimés et restauration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn().mockResolvedValue(page([]))
    svc.restore = vi.fn().mockResolvedValue({ id: 'r1' })
    svc.bulkRestore = vi.fn().mockResolvedValue({ restored: 1, skipped: 0 })
  })

  it('setDeletedFilter bascule le filtre, repart en page 0 et vide la sélection', async () => {
    svc.list.mockResolvedValue(page([deletedRow('r1')]))
    const r = useReports()
    await r.goToPage(2)
    r.toggleSelect('x')
    await r.setDeletedFilter(true)
    expect(r.filters.deleted).toBe(true)
    expect(r.currentPage.value).toBe(0)
    expect(r.selectedIds.value).toEqual([])
    expect(r.reports.value).toHaveLength(1)
    expect(r.deletedFilterUnsupported.value).toBe(false)
  })

  it('un ancien back qui ignore deleted=true (aucun deletedAt) vide la liste et le signale', async () => {
    svc.list.mockResolvedValue(page([{ id: 'r1' }, { id: 'r2' }], 2))
    const r = useReports()
    await r.setDeletedFilter(true)
    expect(r.deletedFilterUnsupported.value).toBe(true)
    expect(r.reports.value).toEqual([])
    expect(r.totalPages.value).toBe(0)
    expect(r.totalElements.value).toBe(0)
  })

  it('une page vide sous le filtre n’est pas prise pour un ancien back', async () => {
    const r = useReports()
    await r.setDeletedFilter(true)
    expect(r.deletedFilterUnsupported.value).toBe(false)
  })

  it('hors filtre Supprimés, des lignes sans deletedAt sont normales', async () => {
    svc.list.mockResolvedValue(page([{ id: 'r1' }]))
    const r = useReports()
    await r.fetchReports()
    expect(r.deletedFilterUnsupported.value).toBe(false)
    expect(r.reports.value).toHaveLength(1)
  })

  it('« tous les résultats » n’est pas proposé sous le filtre Supprimés (bulk-restore par identifiants)', async () => {
    svc.list.mockResolvedValue(page([deletedRow('r1')], 50))
    const r = useReports()
    await r.setDeletedFilter(true)
    r.togglePage()
    expect(r.canSelectAllResults.value).toBe(false)
  })

  it('restoreOne envoie le motif, recharge et rend true', async () => {
    const r = useReports()
    const ok = await r.restoreOne('r1', 'supprimé par erreur')
    expect(ok).toBe(true)
    expect(svc.restore).toHaveBeenCalledWith('r1', 'supprimé par erreur')
    expect(svc.list).toHaveBeenCalled()
  })

  it('restoreOne sur 409 report-not-deleted affiche le detail et recharge', async () => {
    svc.restore.mockRejectedValue(Object.assign(new Error('409'), { statusCode: 409, data: { code: 'report-not-deleted', detail: 'Ce signalement n’est pas supprimé.' } }))
    const r = useReports()
    const ok = await r.restoreOne('r1', 'supprimé par erreur')
    expect(ok).toBe(false)
    expect(r.error.value).toBe('Ce signalement n’est pas supprimé.')
    expect(svc.list).toHaveBeenCalled()
  })

  it('restoreOne sur endpoint absent masque l’action sans erreur rouge', async () => {
    svc.restore.mockRejectedValue(missing())
    const r = useReports()
    const ok = await r.restoreOne('r1', 'supprimé par erreur')
    expect(ok).toBe(false)
    expect(r.restoreUnavailable.value).toBe(true)
    expect(r.error.value).toBeNull()
  })

  it('restoreSelected envoie les identifiants cochés et rend restored/skipped', async () => {
    svc.list.mockResolvedValue(page([deletedRow('a'), deletedRow('b')]))
    svc.bulkRestore.mockResolvedValue({ restored: 1, skipped: 1 })
    const r = useReports()
    await r.setDeletedFilter(true)
    r.togglePage()
    const res = await r.restoreSelected()
    expect(svc.bulkRestore).toHaveBeenCalledWith(['a', 'b'])
    expect(res).toEqual({ restored: 1, skipped: 1 })
    expect(r.selectedIds.value).toEqual([])
  })

  it('restoreSelected sans sélection ne fait rien', async () => {
    const r = useReports()
    expect(await r.restoreSelected()).toBeNull()
    expect(svc.bulkRestore).not.toHaveBeenCalled()
  })

  it('restoreSelected borne l’envoi à 100 identifiants', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => deletedRow(`id${i}`))
    svc.list.mockResolvedValue(page(rows))
    const r = useReports()
    await r.setDeletedFilter(true)
    r.togglePage()
    await r.restoreSelected()
    expect(svc.bulkRestore.mock.calls[0][0]).toHaveLength(100)
  })

  it('restoreSelected sur endpoint absent masque l’action', async () => {
    svc.list.mockResolvedValue(page([deletedRow('a')]))
    svc.bulkRestore.mockRejectedValue(missing())
    const r = useReports()
    await r.setDeletedFilter(true)
    r.toggleSelect('a')
    expect(await r.restoreSelected()).toBeNull()
    expect(r.restoreUnavailable.value).toBe(true)
  })

  it('restoreSelected sur autre erreur affiche le detail', async () => {
    svc.list.mockResolvedValue(page([deletedRow('a')]))
    svc.bulkRestore.mockRejectedValue(Object.assign(new Error('422'), { statusCode: 422, data: { detail: 'Trop d’identifiants' } }))
    const r = useReports()
    await r.setDeletedFilter(true)
    r.toggleSelect('a')
    expect(await r.restoreSelected()).toBeNull()
    expect(r.error.value).toBe('Trop d’identifiants')
    expect(r.restoreUnavailable.value).toBe(false)
  })
})
