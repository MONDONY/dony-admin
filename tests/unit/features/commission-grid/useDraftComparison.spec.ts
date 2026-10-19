import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const svc = vi.hoisted(() => ({ list: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), simulate: vi.fn() }))
vi.mock('@/features/commission-grid/services/commissionGridService', () => ({ commissionGridService: svc }))

import { useDraftComparison, COMPARISON_DEBOUNCE_MS } from '@/features/commission-grid/composables/useDraftComparison'
import { draftFromGrid } from '@/features/commission-grid/utils/grid'
import { COMPARISON_NETS } from '@/features/commission-grid/types/index'
import type { GridDraft } from '@/features/commission-grid/types/index'
import { httpError, row, simulation } from './fixtures'

function setup(initial: GridDraft | null = draftFromGrid(null)) {
  const draft = ref<GridDraft | null>(initial)
  const scope = effectScope()
  const c = scope.run(() => useDraftComparison(draft))!
  return { draft, c, scope }
}

describe('useDraftComparison', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('simule le brouillon après le temps de repos, sur les nets de comparaison en euros', async () => {
    svc.simulate.mockResolvedValue(simulation([row(20, 1, 1.4)], ['INCREASE_WITHIN_30_DAYS']))
    const { c } = setup()
    expect(svc.simulate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(COMPARISON_DEBOUNCE_MS)
    expect(svc.simulate).toHaveBeenCalledTimes(1)
    const req = svc.simulate.mock.calls[0]![0]
    expect(req.currency).toBe('EUR')
    expect(req.nets).toEqual([...COMPARISON_NETS])
    expect(req.draft.tiers[0]).toEqual({ fromEur: 0, rate: 0.07 })
    expect(req.draft.acknowledgedWarnings).toEqual([])
    expect(c.rows.value).toHaveLength(1)
    expect(c.warnings.value).toEqual(['INCREASE_WITHIN_30_DAYS'])
    expect(c.isLoading.value).toBe(false)
  })

  it('debounce : plusieurs saisies rapprochées = un seul appel', async () => {
    svc.simulate.mockResolvedValue(simulation([]))
    const { draft } = setup()
    await vi.advanceTimersByTimeAsync(100)
    draft.value!.tiers[0]!.ratePercent = '8'
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)
    draft.value!.tiers[0]!.ratePercent = '9'
    await nextTick()
    await vi.advanceTimersByTimeAsync(COMPARISON_DEBOUNCE_MS)
    expect(svc.simulate).toHaveBeenCalledTimes(1)
    expect(svc.simulate.mock.calls[0]![0].draft.tiers[0].rate).toBe(0.09)
  })

  it('une réponse périmée est ignorée', async () => {
    let resolveFirst!: (_v: unknown) => void
    svc.simulate
      .mockReturnValueOnce(new Promise((r) => { resolveFirst = r }))
      .mockResolvedValueOnce(simulation([row(10, 0.7, 0.8)]))
    const { c } = setup()
    const first = c.flush()
    const second = c.flush()
    await second
    resolveFirst(simulation([row(5, 1, 1)]))
    await first
    expect(c.rows.value[0]!.net).toBe(10)
  })

  it('422 validation : erreurs par champ, pas de lignes', async () => {
    svc.simulate.mockRejectedValue(httpError(422, { code: 'validation', violations: { 'tiers[1].rate': 'Le taux doit être compris entre 0 % et 30 %.' } }))
    const { c } = setup()
    await c.flush()
    expect(c.violations.value).toEqual({ 'tiers[1].rate': 'Le taux doit être compris entre 0 % et 30 %.' })
    expect(c.error.value).toBeNull()
    expect(c.rows.value).toEqual([])
  })

  it('erreur sans violation : message général ; une réussite l’efface', async () => {
    svc.simulate.mockRejectedValueOnce(httpError(500, { detail: 'Panne' }))
    const { c } = setup()
    await c.flush()
    expect(c.error.value).toBe('Panne')
    svc.simulate.mockResolvedValueOnce(simulation([row(5, 1, 1)]))
    await c.flush()
    expect(c.error.value).toBeNull()
    expect(c.violations.value).toEqual({})
  })

  it('endpoint absent → unavailable', async () => {
    svc.simulate.mockRejectedValue(httpError(404))
    const { c } = setup()
    await c.flush()
    expect(c.unavailable.value).toBe(true)
  })

  it('brouillon retiré : état vidé sans appel ; arrêt du scope = minuteur annulé', async () => {
    svc.simulate.mockResolvedValue(simulation([row(5, 1, 1)]))
    const { draft, c, scope } = setup()
    await c.flush()
    draft.value = null
    await nextTick()
    expect(c.rows.value).toEqual([])
    draft.value = draftFromGrid(null)
    await nextTick()
    scope.stop()
    await vi.advanceTimersByTimeAsync(COMPARISON_DEBOUNCE_MS * 2)
    expect(svc.simulate).toHaveBeenCalledTimes(1)
  })

  it('sans brouillon initial : aucun appel', async () => {
    setup(null)
    await vi.advanceTimersByTimeAsync(COMPARISON_DEBOUNCE_MS)
    expect(svc.simulate).not.toHaveBeenCalled()
  })

  it('réponse sans lignes ni avertissements ; un échec périmé est ignoré', async () => {
    let rejectFirst!: (_e: unknown) => void
    svc.simulate
      .mockReturnValueOnce(new Promise((_, rej) => { rejectFirst = rej }))
      .mockResolvedValueOnce({ connectActiveAccountMonthly: 2 })
    const { c } = setup()
    const first = c.flush()
    await c.flush()
    rejectFirst(httpError(500, { detail: 'Panne' }))
    await first
    expect(c.rows.value).toEqual([])
    expect(c.warnings.value).toEqual([])
    expect(c.error.value).toBeNull()
    expect(c.isLoading.value).toBe(false)
  })
})
