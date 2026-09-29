import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/signalements/services/reportsService')
import { useReports } from '@/features/signalements/composables/useReports'
import { reportsService } from '@/features/signalements/services/reportsService'
const svc = reportsService as any

const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const httpError = (status: number, data?: Record<string, unknown>) =>
  Object.assign(new Error(`${status}`), { statusCode: status, data })

describe('useReports : signalement ouvert par lien et réponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn().mockResolvedValue(page([{ id: 'r1' }, { id: 'r2' }]))
    svc.get = vi.fn()
  })

  it('openReport hors de la page : le signalement passe en tête', async () => {
    svc.get.mockResolvedValue({ id: 'r9', targetType: 'APP' })
    const r = useReports()
    await r.fetchReports()
    await r.openReport('r9')
    expect(svc.get).toHaveBeenCalledWith('r9')
    expect(r.focusedReport.value?.id).toBe('r9')
    expect(r.displayedReports.value.map((x) => x.id)).toEqual(['r9', 'r1', 'r2'])
  })

  it('openReport déjà sur la page : pas de doublon', async () => {
    svc.get.mockResolvedValue({ id: 'r2' })
    const r = useReports()
    await r.fetchReports()
    await r.openReport('r2')
    expect(r.displayedReports.value.map((x) => x.id)).toEqual(['r1', 'r2'])
  })

  it('openReport introuvable : message, rien en tête', async () => {
    svc.get.mockRejectedValue(httpError(404, { code: 'report-not-found' }))
    const r = useReports()
    await r.fetchReports()
    await r.openReport('zz')
    expect(r.focusedReport.value).toBeNull()
    expect(r.focusError.value).toContain('introuvable')
    expect(r.displayedReports.value).toHaveLength(2)
  })

  it('openReport autre erreur : detail du back', async () => {
    svc.get.mockRejectedValue(httpError(500, { detail: 'Panne' }))
    const r = useReports()
    await r.openReport('zz')
    expect(r.focusError.value).toBe('Panne')
  })

  it('closeFocus efface la mise en avant', async () => {
    svc.get.mockResolvedValue({ id: 'r9' })
    const r = useReports()
    await r.openReport('r9')
    r.closeFocus()
    expect(r.focusedReport.value).toBeNull()
    expect(r.focusError.value).toBeNull()
  })

  it('markReplied pose supportTicketId sur la ligne et sur le signalement ouvert', async () => {
    svc.get.mockResolvedValue({ id: 'r9' })
    const r = useReports()
    await r.fetchReports()
    await r.openReport('r9')
    r.markReplied('r1', 't1')
    r.markReplied('r9', 't2')
    expect(r.reports.value.find((x) => x.id === 'r1')?.supportTicketId).toBe('t1')
    expect(r.reports.value.find((x) => x.id === 'r2')?.supportTicketId).toBeUndefined()
    expect(r.focusedReport.value?.supportTicketId).toBe('t2')
  })

  it('findReport cherche aussi le signalement ouvert', async () => {
    svc.get.mockResolvedValue({ id: 'r9' })
    const r = useReports()
    await r.fetchReports()
    expect(r.findReport('r9')).toBeNull()
    await r.openReport('r9')
    expect(r.findReport('r9')?.id).toBe('r9')
    expect(r.findReport('r1')?.id).toBe('r1')
    expect(r.findReport(null)).toBeNull()
  })
})

describe('useReports : traiter le signalement ouvert par lien', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn().mockResolvedValue(page([{ id: 'r1' }]))
    svc.get = vi.fn().mockResolvedValue({ id: 'r9', status: 'OPEN', supportTicketId: 't1' })
    svc.resolve = vi.fn().mockResolvedValue({ id: 'r9', status: 'RESOLVED', actionTaken: 'RESOLVE' })
  })

  it('le traitement met aussi à jour le signalement ouvert, conversation conservée', async () => {
    const r = useReports()
    await r.fetchReports()
    await r.openReport('r9')
    expect(await r.resolve('r9', 'RESOLVE', '')).toBe('ok')
    expect(r.focusedReport.value?.status).toBe('RESOLVED')
    expect(r.focusedReport.value?.supportTicketId).toBe('t1')
  })
})
