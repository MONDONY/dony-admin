import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'

vi.mock('@/features/photo-storage/services/photoStorageService')
import { usePhotoStorage } from '@/features/photo-storage/composables/usePhotoStorage'
import { photoStorageService } from '@/features/photo-storage/services/photoStorageService'

const svc = photoStorageService as unknown as Record<string, ReturnType<typeof vi.fn>>

const status = {
  purgeEnabled: true, retentionDays: 7, running: false,
  lastPurges: [], lastReconciles: [],
  uploads24h: 3, bytes24h: 1000, uploads7d: 20, bytes7d: 9000,
}
// Forme réelle d'une FetchError ofetch : status, statusCode, response.status et data.
const fetchError = (code: number, data?: unknown) =>
  Object.assign(new Error(`[GET] "/x": ${code}`), { status: code, statusCode: code, response: { status: code }, data })

describe('usePhotoStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.status = vi.fn()
    svc.runPurge = vi.fn()
    svc.reconcile = vi.fn()
  })
  afterEach(() => vi.useRealTimers())

  it('load remplit le statut', async () => {
    svc.status.mockResolvedValue(status)
    const p = usePhotoStorage()
    await p.load()
    expect(p.status.value).toEqual(status)
    expect(p.unavailable.value).toBe(false)
    expect(p.loading.value).toBe(false)
  })

  it('load en 404 marque indisponible sans erreur', async () => {
    svc.status.mockRejectedValue(fetchError(404))
    const p = usePhotoStorage()
    await p.load()
    expect(p.unavailable.value).toBe(true)
    expect(p.error.value).toBeNull()
  })

  it('load en 500 expose le detail du ProblemDetail', async () => {
    svc.status.mockRejectedValue(fetchError(500, { detail: 'Boum serveur' }))
    const p = usePhotoStorage()
    await p.load()
    expect(p.error.value).toBe('Boum serveur')
    expect(p.unavailable.value).toBe(false)
  })

  it('runPurge en 409 affiche un avis « déjà en cours » sans erreur', async () => {
    svc.runPurge.mockRejectedValue(fetchError(409, { detail: 'x' }))
    const p = usePhotoStorage()
    await p.runPurge()
    expect(p.notice.value).toContain('déjà en cours')
    expect(p.error.value).toBeNull()
  })

  it('runPurge en 500 expose une erreur', async () => {
    svc.runPurge.mockRejectedValue(fetchError(500, { detail: 'Échec' }))
    const p = usePhotoStorage()
    await p.runPurge()
    expect(p.error.value).toBe('Échec')
    expect(p.notice.value).toBeNull()
  })

  it('reconcile(true) appelle le service avec true', async () => {
    svc.reconcile.mockResolvedValue({ started: true })
    const p = usePhotoStorage()
    await p.reconcile(true)
    expect(svc.reconcile).toHaveBeenCalledWith(true)
    expect(p.notice.value).toBe('Passage lancé, actualisez dans un instant.')
  })

  it('un POST accepté recharge le statut après 3 s', async () => {
    vi.useFakeTimers()
    svc.runPurge.mockResolvedValue({ started: true })
    svc.status.mockResolvedValue(status)
    const p = usePhotoStorage()
    await p.runPurge()
    expect(p.notice.value).toBe('Passage lancé, actualisez dans un instant.')
    expect(svc.status).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2999)
    expect(svc.status).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(svc.status).toHaveBeenCalledTimes(1)
    expect(p.status.value).toEqual(status)
  })

  it('le rechargement différé est annulé à la destruction du scope', async () => {
    vi.useFakeTimers()
    svc.runPurge.mockResolvedValue({ started: true })
    svc.status.mockResolvedValue(status)
    const scope = effectScope()
    const p = scope.run(() => usePhotoStorage())!
    await p.runPurge()
    scope.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(svc.status).not.toHaveBeenCalled()
  })
})
