import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const svc = vi.hoisted(() => ({ list: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), simulate: vi.fn() }))
vi.mock('@/features/commission-grid/services/commissionGridService', () => ({ commissionGridService: svc }))

import {
  useMarginSimulator, SIMULATOR_DEBOUNCE_MS, VAT_STORAGE_KEY, type SimulatorSource,
} from '@/features/commission-grid/composables/useMarginSimulator'
import { httpError, row, simulation } from './fixtures'

function setup(src: SimulatorSource | null = { gridId: 'g1' }) {
  const source = ref<SimulatorSource | null>(src)
  const scope = effectScope()
  const s = scope.run(() => useMarginSimulator(source))!
  return { source, s, scope }
}

describe('useMarginSimulator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
    svc.simulate.mockResolvedValue(simulation([row(20, 1, 1.4)]))
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('run simule la grille choisie pour le montant, la devise et la TVA', async () => {
    const { s } = setup()
    expect(s.vatPercent.value).toBe('20')
    await s.run()
    expect(svc.simulate).toHaveBeenCalledWith({ gridId: 'g1', currency: 'EUR', nets: [20], vatRatePercent: 20 })
    expect(s.row.value?.draft.commission).toBe(1.4)
    expect(s.connectMonthly.value).toBe(2)
    expect(s.isLoading.value).toBe(false)
  })

  it('recalcule après le temps de repos quand la saisie change, une seule fois', async () => {
    const { s } = setup({ draft: { tiers: [], minimums: {}, effectiveFrom: null, note: null, acknowledgedWarnings: [] } })
    s.amount.value = '50'
    await nextTick()
    s.currency.value = 'XOF'
    await nextTick()
    await vi.advanceTimersByTimeAsync(SIMULATOR_DEBOUNCE_MS)
    expect(svc.simulate).toHaveBeenCalledTimes(1)
    expect(svc.simulate.mock.calls[0]![0]).toMatchObject({ currency: 'XOF', nets: [50] })
    expect(svc.simulate.mock.calls[0]![0].draft).toBeDefined()
  })

  it('saisie invalide : erreur locale, aucun appel', async () => {
    const { s } = setup()
    s.amount.value = '0'
    expect(s.inputError.value).toBe('Saisissez un montant net positif.')
    await s.run()
    s.amount.value = '20'
    s.vatPercent.value = '-1'
    expect(s.inputError.value).toBe('Saisissez un taux de TVA positif ou nul.')
    await s.run()
    expect(svc.simulate).not.toHaveBeenCalled()
    expect(s.row.value).toBeNull()
  })

  it('sans source : aucun appel', async () => {
    const { s } = setup(null)
    await s.run()
    expect(svc.simulate).not.toHaveBeenCalled()
  })

  it('TVA mémorisée dans le navigateur et relue au démarrage', async () => {
    const first = setup()
    first.s.vatPercent.value = '18'
    await nextTick()
    expect(localStorage.getItem(VAT_STORAGE_KEY)).toBe('18')
    first.s.vatPercent.value = 'abc'
    await nextTick()
    expect(localStorage.getItem(VAT_STORAGE_KEY)).toBe('18')
    expect(setup().s.vatPercent.value).toBe('18')
  })

  it('valeur mémorisée illisible → 20 %', () => {
    localStorage.setItem(VAT_STORAGE_KEY, 'zzz')
    expect(setup().s.vatPercent.value).toBe('20')
  })

  it('stockage bloqué (navigation privée) : 20 % et aucune exception', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { s } = setup()
    expect(s.vatPercent.value).toBe('20')
    s.vatPercent.value = '10'
    await nextTick()
    expect(s.vatPercent.value).toBe('10')
  })

  it('erreur : première violation, sinon message ; endpoint absent → unavailable', async () => {
    const { s } = setup()
    svc.simulate.mockRejectedValueOnce(httpError(422, { violations: { vatRatePercent: 'La TVA ne peut pas être négative.' } }))
    await s.run()
    expect(s.error.value).toBe('La TVA ne peut pas être négative.')
    svc.simulate.mockRejectedValueOnce(httpError(500, { detail: 'Panne' }))
    await s.run()
    expect(s.error.value).toBe('Panne')
    svc.simulate.mockRejectedValueOnce(httpError(404))
    await s.run()
    expect(s.unavailable.value).toBe(true)
    svc.simulate.mockResolvedValueOnce({ rows: [], connectActiveAccountMonthly: undefined })
    await s.run()
    expect(s.row.value).toBeNull()
    expect(s.connectMonthly.value).toBeNull()
    expect(s.error.value).toBeNull()
  })

  it('une réponse périmée est ignorée ; arrêt du scope = minuteur annulé', async () => {
    let resolveFirst!: (_v: unknown) => void
    svc.simulate
      .mockReturnValueOnce(new Promise((r) => { resolveFirst = r }))
      .mockResolvedValueOnce(simulation([row(30, 2, 2.1)]))
    const { s, scope } = setup()
    const first = s.run()
    await s.run()
    resolveFirst(simulation([row(5, 1, 1)]))
    await first
    expect(s.row.value?.net).toBe(30)

    svc.simulate.mockRejectedValueOnce(httpError(500))
    let rejectThird!: (_e: unknown) => void
    svc.simulate.mockReset()
    svc.simulate
      .mockReturnValueOnce(new Promise((_, rej) => { rejectThird = rej }))
      .mockResolvedValueOnce(simulation([row(40, 2, 2.1)]))
    const third = s.run()
    await s.run()
    rejectThird(httpError(500))
    await third
    expect(s.error.value).toBeNull()

    s.amount.value = '99'
    await nextTick()
    scope.stop()
    await vi.advanceTimersByTimeAsync(SIMULATOR_DEBOUNCE_MS * 2)
    expect(svc.simulate).toHaveBeenCalledTimes(2)
  })
})
