/** Commissions mobile money : chargement à la première visite, période, erreur lisible et nouvel essai. */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const svc = vi.hoisted(() => ({ getMobileMoneyCommissionsForDays: vi.fn() }))
vi.mock('@/features/finance/services/financeService', () => ({ financeService: svc }))

import { useMobileMoneyCommissions } from '@/features/finance/composables/useMobileMoneyCommissions'

const DATA = { from: '2025-10-01T00:00:00', to: '2026-10-01T00:00:00', byCurrency: [], monthly: [] }

describe('useMobileMoneyCommissions', () => {
  beforeEach(() => { svc.getMobileMoneyCommissionsForDays.mockReset() })

  it('ensure : charge une fois sans période (12 derniers mois côté back), pas de second appel', async () => {
    svc.getMobileMoneyCommissionsForDays.mockResolvedValue(DATA)
    const c = useMobileMoneyCommissions()
    await c.ensure()
    await c.ensure()
    expect(svc.getMobileMoneyCommissionsForDays).toHaveBeenCalledTimes(1)
    expect(svc.getMobileMoneyCommissionsForDays).toHaveBeenCalledWith(null, null)
    expect(c.data.value).toEqual(DATA)
    expect(c.loading.value).toBe(false)
  })

  it('setPeriod : bornes gardées et relues', async () => {
    svc.getMobileMoneyCommissionsForDays.mockResolvedValue(DATA)
    const c = useMobileMoneyCommissions()
    await c.setPeriod('2026-08-01', '2026-08-31')
    expect(c.from.value).toBe('2026-08-01')
    expect(c.to.value).toBe('2026-08-31')
    expect(svc.getMobileMoneyCommissionsForDays).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31')
  })

  it('échec : message du back, puis ensure réessaie et efface l’erreur', async () => {
    svc.getMobileMoneyCommissionsForDays.mockRejectedValueOnce({ data: { detail: 'Base indisponible' } })
    const c = useMobileMoneyCommissions()
    await c.ensure()
    expect(c.error.value).toBe('Base indisponible')
    expect(c.data.value).toBeNull()
    svc.getMobileMoneyCommissionsForDays.mockResolvedValueOnce(DATA)
    await c.ensure()
    expect(c.error.value).toBeNull()
    expect(c.data.value).toEqual(DATA)
  })
})
