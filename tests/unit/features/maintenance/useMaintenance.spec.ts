import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/maintenance/services/maintenanceService')
import { useMaintenance } from '@/features/maintenance/composables/useMaintenance'
import { maintenanceService } from '@/features/maintenance/services/maintenanceService'
import type { MaintenanceState } from '@/features/maintenance/types/index'

const svc = maintenanceService as unknown as Record<string, ReturnType<typeof vi.fn>>

const state = (over: Partial<MaintenanceState> = {}): MaintenanceState => ({
  enabled: false, message: null, estimatedEndAt: null, startedAt: null,
  updatedAt: null, updatedByEmail: null, exemptions: [], ...over,
})
const fetchError = (code: number, data?: unknown) =>
  Object.assign(new Error(`[GET] "/x": ${code}`), { status: code, statusCode: code, response: { status: code }, data })

describe('useMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.get = vi.fn()
    svc.update = vi.fn()
    svc.addExemption = vi.fn()
    svc.removeExemption = vi.fn()
  })

  it('load remplit l’état', async () => {
    svc.get.mockResolvedValue(state({ enabled: true }))
    const m = useMaintenance()
    await m.load()
    expect(m.state.value?.enabled).toBe(true)
    expect(m.loading.value).toBe(false)
    expect(m.unavailable.value).toBe(false)
  })

  it('load en 404 marque indisponible sans erreur', async () => {
    svc.get.mockRejectedValue(fetchError(404))
    const m = useMaintenance()
    await m.load()
    expect(m.unavailable.value).toBe(true)
    expect(m.error.value).toBeNull()
  })

  it('load en 500 affiche une erreur', async () => {
    svc.get.mockRejectedValue(fetchError(500))
    const m = useMaintenance()
    await m.load()
    expect(m.error.value).toBeTruthy()
  })

  it('update remplace l’état et renvoie vrai', async () => {
    svc.update.mockResolvedValue(state({ enabled: true }))
    const m = useMaintenance()
    const ok = await m.update({ enabled: true, message: null, estimatedEndAt: null })
    expect(ok).toBe(true)
    expect(m.state.value?.enabled).toBe(true)
    expect(m.busy.value).toBe(false)
  })

  it('update en échec garde l’état et affiche le détail du back', async () => {
    svc.update.mockRejectedValue(fetchError(422, { detail: 'L’heure de fin estimée doit être dans le futur' }))
    const m = useMaintenance()
    const ok = await m.update({ enabled: true, message: null, estimatedEndAt: '2020-01-01T00:00:00Z' })
    expect(ok).toBe(false)
    expect(m.error.value).toContain('dans le futur')
  })

  it('une seule écriture à la fois', async () => {
    // eslint-disable-next-line no-unused-vars
    let resolve!: (s: MaintenanceState) => void
    svc.addExemption.mockReturnValue(new Promise((r) => { resolve = r }))
    const m = useMaintenance()
    const first = m.addExemption('u1', null)
    expect(await m.removeExemption('u1')).toBe(false)
    resolve(state())
    expect(await first).toBe(true)
    expect(svc.removeExemption).not.toHaveBeenCalled()
  })

  it('removeExemption remplace l’état', async () => {
    svc.removeExemption.mockResolvedValue(state())
    const m = useMaintenance()
    expect(await m.removeExemption('u1')).toBe(true)
    expect(svc.removeExemption).toHaveBeenCalledWith('u1')
  })
})
