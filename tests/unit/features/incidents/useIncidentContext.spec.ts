import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/incidents/services/incidentsService')
import { isIncidentContext, useIncidentContext } from '@/features/incidents/composables/useIncidentContext'
import { incidentsService } from '@/features/incidents/services/incidentsService'
const svc = incidentsService as any

const ctx = { related: [{ kind: 'DISPUTE', id: 'd2', type: 'ADMIN_OTHER', open: true, createdAt: '2026-10-01T10:00:00' }], history: [] }

describe('useIncidentContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.getDisputeContext = vi.fn().mockResolvedValue(ctx)
    svc.getNoShowContext = vi.fn().mockResolvedValue({ related: [], history: [] })
  })

  it('une clé de litige lit le contexte du litige', async () => {
    const c = useIncidentContext()
    await c.load('dispute:d1')
    expect(svc.getDisputeContext).toHaveBeenCalledWith('d1')
    expect(c.context.value).toEqual(ctx)
  })

  it('une clé d’absence lit le contexte de l’absence', async () => {
    const c = useIncidentContext()
    await c.load('noshow:c1')
    expect(svc.getNoShowContext).toHaveBeenCalledWith('c1')
    expect(svc.getDisputeContext).not.toHaveBeenCalled()
  })

  it('ancien back (404 sans code) : rien à montrer ni à dire', async () => {
    svc.getDisputeContext.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }))
    const c = useIncidentContext()
    await c.load('dispute:d1')
    expect(c.context.value).toBeNull()
    expect(c.error.value).toBeNull()
    expect(c.unavailable.value).toBe(true)
  })

  it('panne : une phrase', async () => {
    svc.getDisputeContext.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Base indisponible' } }))
    const c = useIncidentContext()
    await c.load('dispute:d1')
    expect(c.error.value).toBe('Base indisponible')
  })

  it('une réponse d’une autre forme n’est pas un contexte', async () => {
    svc.getDisputeContext.mockResolvedValue('<html>')
    const c = useIncidentContext()
    await c.load('dispute:d1')
    expect(c.context.value).toBeNull()
    expect(c.unavailable.value).toBe(true)
  })

  it('garde de forme', () => {
    expect(isIncidentContext(ctx)).toBe(true)
    expect(isIncidentContext({ related: [] })).toBe(false)
    expect(isIncidentContext(null)).toBe(false)
    expect(isIncidentContext('x')).toBe(false)
  })
})
