import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/app-update/services/appUpdateService')
import { useAppUpdate } from '@/features/app-update/composables/useAppUpdate'
import { appUpdateService } from '@/features/app-update/services/appUpdateService'

const svc = appUpdateService as unknown as Record<string, ReturnType<typeof vi.fn>>
const fetchError = (code: number, data?: unknown) =>
  Object.assign(new Error(`[PUT] "/x": ${code}`), { status: code, statusCode: code, response: { status: code }, data })

describe('useAppUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.get = vi.fn()
    svc.update = vi.fn()
  })

  it('load remplit l’état', async () => {
    svc.get.mockResolvedValue({ recommendedBuild: 1070, minSupportedBuild: 1000 })
    const m = useAppUpdate()
    await m.load()
    expect(m.state.value).toEqual({ recommendedBuild: 1070, minSupportedBuild: 1000 })
    expect(m.loading.value).toBe(false)
  })

  it('load en 404 marque indisponible sans erreur', async () => {
    svc.get.mockRejectedValue(fetchError(404))
    const m = useAppUpdate()
    await m.load()
    expect(m.unavailable.value).toBe(true)
    expect(m.error.value).toBeNull()
  })

  it('load en 500 affiche une erreur et permet de réessayer', async () => {
    svc.get.mockRejectedValue(fetchError(500))
    const m = useAppUpdate()
    await m.load()
    expect(m.error.value).toBeTruthy()
    expect(m.loadFailed.value).toBe(true)
  })

  it('load en 403 affiche le message de droit manquant', async () => {
    svc.get.mockRejectedValue(fetchError(403))
    const m = useAppUpdate()
    await m.load()
    expect(m.error.value).toContain('pas le droit')
  })

  it('save remplace l’état et renvoie vrai', async () => {
    svc.update.mockResolvedValue({ recommendedBuild: 1082, minSupportedBuild: 1000 })
    const m = useAppUpdate()
    expect(await m.save(1082)).toBe(true)
    expect(svc.update).toHaveBeenCalledWith({ recommendedBuild: 1082 })
    expect(m.state.value?.recommendedBuild).toBe(1082)
    expect(m.busy.value).toBe(false)
  })

  it.each([
    [409, 'La configuration a changé entre-temps, réessaie.'],
    [422, 'Valeur invalide'],
    [503, 'Firebase est injoignable'],
    [403, 'pas le droit'],
  ])('save en %i affiche un message français', async (code, fragment) => {
    svc.update.mockRejectedValue(fetchError(code, { detail: 'English detail' }))
    const m = useAppUpdate()
    expect(await m.save(5)).toBe(false)
    expect(m.error.value).toContain(fragment)
  })

  it('save sur un autre statut reprend le detail du back, sinon un repli', async () => {
    svc.update.mockRejectedValueOnce(fetchError(500, { detail: 'Boum' }))
    const m = useAppUpdate()
    await m.save(5)
    expect(m.error.value).toBe('Boum')
    svc.update.mockRejectedValueOnce(fetchError(500))
    await m.save(5)
    expect(m.error.value).toBe('Enregistrement impossible, réessaie.')
  })

  it('refuse une seconde écriture pendant qu’une est en cours', async () => {
    let release: () => void = () => {}
    svc.update.mockReturnValue(new Promise((resolve) => {
      release = () => resolve({ recommendedBuild: 5, minSupportedBuild: 0 })
    }))
    const m = useAppUpdate()
    const first = m.save(5)
    expect(await m.save(6)).toBe(false)
    release()
    await first
    expect(svc.update).toHaveBeenCalledTimes(1)
  })
})
