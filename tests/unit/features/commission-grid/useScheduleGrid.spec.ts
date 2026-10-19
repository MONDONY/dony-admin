import { describe, it, expect, vi, beforeEach } from 'vitest'

const svc = vi.hoisted(() => ({ list: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), simulate: vi.fn() }))
vi.mock('@/features/commission-grid/services/commissionGridService', () => ({ commissionGridService: svc }))

import { useScheduleGrid } from '@/features/commission-grid/composables/useScheduleGrid'
import { draftFromGrid } from '@/features/commission-grid/utils/grid'
import { COMMISSION_GRID_UNAVAILABLE } from '@/features/commission-grid/types/index'
import { GRID, httpError, simulation } from './fixtures'

describe('useScheduleGrid', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('prepare renvoie les avertissements du brouillon', async () => {
    svc.simulate.mockResolvedValue(simulation([], ['INCREASE_WITHIN_30_DAYS']))
    const s = useScheduleGrid()
    expect(await s.prepare(draftFromGrid(null))).toEqual(['INCREASE_WITHIN_30_DAYS'])
    expect(svc.simulate.mock.calls[0]![0]).toMatchObject({ currency: 'EUR', nets: [100] })
    expect(s.busy.value).toBe(false)
  })

  it('prepare : réponse sans avertissement = liste vide', async () => {
    svc.simulate.mockResolvedValue({ rows: [], connectActiveAccountMonthly: 2 })
    expect(await useScheduleGrid().prepare(draftFromGrid(null))).toEqual([])
  })

  it('prepare : brouillon invalide → null et violations', async () => {
    svc.simulate.mockRejectedValue(httpError(422, { code: 'commission-grid-effective-in-past', violations: { effectiveFrom: 'Dans le passé' } }))
    const s = useScheduleGrid()
    expect(await s.prepare(draftFromGrid(null))).toBeNull()
    expect(s.violations.value).toEqual({ effectiveFrom: 'Dans le passé' })
    expect(s.error.value).toBeNull()
  })

  it('schedule sans avertissement → programmée', async () => {
    svc.schedule.mockResolvedValue(GRID)
    const s = useScheduleGrid()
    const out = await s.schedule(draftFromGrid(GRID), [])
    expect(out).toEqual({ status: 'scheduled', grid: GRID })
    expect(svc.schedule.mock.calls[0]![0].acknowledgedWarnings).toEqual([])
  })

  it('schedule avec acquittement : les avertissements partent dans le corps', async () => {
    svc.schedule.mockResolvedValue(GRID)
    await useScheduleGrid().schedule(draftFromGrid(GRID), ['INCREASE_WITHIN_30_DAYS'])
    expect(svc.schedule.mock.calls[0]![0].acknowledgedWarnings).toEqual(['INCREASE_WITHIN_30_DAYS'])
  })

  it('schedule : avertissement non acquitté → needs-ack avec les avertissements du back', async () => {
    svc.schedule.mockRejectedValue(httpError(422, {
      code: 'commission-grid-warning-not-acknowledged', warnings: ['INCREASE_WITHIN_30_DAYS', 3],
    }))
    const s = useScheduleGrid()
    expect(await s.schedule(draftFromGrid(GRID), [])).toEqual({ status: 'needs-ack', warnings: ['INCREASE_WITHIN_30_DAYS'] })
    expect(s.error.value).toBeNull()
  })

  it('schedule : code d’acquittement sans liste exploitable → échec avec message', async () => {
    svc.schedule.mockRejectedValue(httpError(422, { code: 'commission-grid-warning-not-acknowledged', detail: 'Acquittez', warnings: 'x' }))
    const s = useScheduleGrid()
    expect(await s.schedule(draftFromGrid(GRID), [])).toEqual({ status: 'failed' })
    expect(s.error.value).toBe('Acquittez')
  })

  it('schedule : violations par champ', async () => {
    svc.schedule.mockRejectedValue(httpError(422, { code: 'validation', violations: { 'minimums.XOF': 'Trop élevé' } }))
    const s = useScheduleGrid()
    expect(await s.schedule(draftFromGrid(GRID), [])).toEqual({ status: 'failed' })
    expect(s.violations.value).toEqual({ 'minimums.XOF': 'Trop élevé' })
  })

  it('endpoint absent → message de mise à jour du serveur ; reset efface', async () => {
    svc.schedule.mockRejectedValue(httpError(405))
    const s = useScheduleGrid()
    await s.schedule(draftFromGrid(GRID), [])
    expect(s.error.value).toBe(COMMISSION_GRID_UNAVAILABLE)
    s.reset()
    expect(s.error.value).toBeNull()
    expect(s.violations.value).toEqual({})
  })
})
