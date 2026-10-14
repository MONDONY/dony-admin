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

  it('lit aussi le statut HTTP depuis statusCode ou response.status', async () => {
    svc.status.mockRejectedValue({ response: { status: 404 } })
    svc.runPurge.mockRejectedValue({ statusCode: 409 })
    const p = usePhotoStorage()
    await p.load()
    expect(p.unavailable.value).toBe(true)
    await p.runPurge()
    expect(p.notice.value).toContain('déjà en cours')
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

  it('load en 404 puis en succès remet indisponible à faux', async () => {
    svc.status.mockRejectedValueOnce(fetchError(404)).mockResolvedValueOnce(status)
    const p = usePhotoStorage()
    await p.load()
    expect(p.unavailable.value).toBe(true)
    await p.load()
    expect(p.unavailable.value).toBe(false)
    expect(p.status.value).toEqual(status)
  })

  it('reconcile en 409 affiche un avis « déjà en cours » sans erreur', async () => {
    svc.reconcile.mockRejectedValue(fetchError(409, { detail: 'x' }))
    const p = usePhotoStorage()
    await p.reconcile(false)
    expect(p.notice.value).toContain('déjà en cours')
    expect(p.error.value).toBeNull()
  })

  it('deux lancements rapides n\'envoient qu\'un seul POST, launching vrai pendant l\'appel', async () => {
    let resolve!: (_v: { started: boolean }) => void
    svc.runPurge.mockReturnValue(new Promise((r) => { resolve = r }))
    svc.reconcile.mockResolvedValue({ started: true })
    const p = usePhotoStorage()
    const first = p.runPurge()
    expect(p.launching.value).toBe(true)
    await p.runPurge()
    await p.reconcile(true)
    expect(svc.runPurge).toHaveBeenCalledTimes(1)
    expect(svc.reconcile).not.toHaveBeenCalled()
    resolve({ started: true })
    await first
    expect(p.launching.value).toBe(false)
  })

  it('launching repasse à faux après un échec', async () => {
    svc.reconcile.mockRejectedValue(fetchError(500))
    const p = usePhotoStorage()
    await p.reconcile(false)
    expect(p.launching.value).toBe(false)
  })

  it('un POST accepté recharge toutes les 5 s tant qu\'un passage tourne', async () => {
    vi.useFakeTimers()
    svc.runPurge.mockResolvedValue({ started: true })
    svc.status
      .mockResolvedValueOnce({ ...status, running: true })
      .mockResolvedValueOnce({ ...status, running: true })
      .mockResolvedValue(status)
    const p = usePhotoStorage()
    await p.runPurge()
    expect(p.notice.value).toBe('Passage lancé, actualisez dans un instant.')
    await vi.advanceTimersByTimeAsync(4999)
    expect(svc.status).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(svc.status).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(svc.status).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(svc.status).toHaveBeenCalledTimes(3)
    expect(p.status.value).toEqual(status)
    // Le passage est terminé : plus aucun rechargement.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(svc.status).toHaveBeenCalledTimes(3)
  })

  it('le suivi s\'arrête après 24 rechargements (2 min) même si le passage tourne encore', async () => {
    vi.useFakeTimers()
    svc.runPurge.mockResolvedValue({ started: true })
    svc.status.mockResolvedValue({ ...status, running: true })
    const p = usePhotoStorage()
    await p.runPurge()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(svc.status).toHaveBeenCalledTimes(24)
  })

  it('un nouveau lancement repart à zéro sans doubler le suivi', async () => {
    vi.useFakeTimers()
    svc.runPurge.mockResolvedValue({ started: true })
    svc.status.mockResolvedValue(status)
    const p = usePhotoStorage()
    await p.runPurge()
    await vi.advanceTimersByTimeAsync(2000)
    await p.runPurge()
    await vi.advanceTimersByTimeAsync(5000)
    expect(svc.status).toHaveBeenCalledTimes(1)
  })

  it('le suivi est annulé à la destruction du scope', async () => {
    vi.useFakeTimers()
    svc.runPurge.mockResolvedValue({ started: true })
    svc.status.mockResolvedValue(status)
    const scope = effectScope()
    const p = scope.run(() => usePhotoStorage())!
    await p.runPurge()
    scope.stop()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(svc.status).not.toHaveBeenCalled()
  })

  it('le suivi remplace « Passage lancé » par « Passage terminé à HH:MM » à la fin du passage', async () => {
    vi.useFakeTimers()
    svc.runPurge.mockResolvedValue({ started: true })
    svc.status.mockResolvedValueOnce({ ...status, running: true }).mockResolvedValue(status)
    const p = usePhotoStorage()
    await p.runPurge()
    await vi.advanceTimersByTimeAsync(5000)
    expect(p.notice.value).toBe('Passage lancé, actualisez dans un instant.')
    await vi.advanceTimersByTimeAsync(5000)
    expect(p.notice.value).toMatch(/^Passage terminé à \d{2}:\d{2}, résultat ci-dessous\.$/)
  })

  it('refreshedAt date le dernier rechargement réussi, pas un échec', async () => {
    svc.status.mockResolvedValueOnce(status).mockRejectedValueOnce(fetchError(500))
    const p = usePhotoStorage()
    expect(p.refreshedAt.value).toBeNull()
    await p.load()
    const first = p.refreshedAt.value
    expect(first).toBeInstanceOf(Date)
    await p.load()
    expect(p.refreshedAt.value).toBe(first)
  })

  it('refresh efface un avis terminé ou « déjà en cours », pas celui d\'un passage suivi', async () => {
    svc.status.mockResolvedValue(status)
    svc.runPurge.mockRejectedValueOnce(fetchError(409)).mockResolvedValue({ started: true })
    const p = usePhotoStorage()
    await p.runPurge()
    expect(p.notice.value).toContain('déjà en cours')
    await p.refresh()
    expect(p.notice.value).toBeNull()
    expect(svc.status).toHaveBeenCalledTimes(1)

    svc.status.mockResolvedValue({ ...status, running: true })
    await p.runPurge()
    await p.refresh()
    expect(p.notice.value).toBe('Passage lancé, actualisez dans un instant.')
  })

  it('un rechargement en vol à la destruction ne relance pas le suivi', async () => {
    vi.useFakeTimers()
    let resolve!: (_v: typeof status) => void
    svc.runPurge.mockResolvedValue({ started: true })
    svc.status.mockReturnValueOnce(new Promise((r) => { resolve = r })).mockResolvedValue({ ...status, running: true })
    const scope = effectScope()
    const p = scope.run(() => usePhotoStorage())!
    await p.runPurge()
    await vi.advanceTimersByTimeAsync(5000)
    expect(svc.status).toHaveBeenCalledTimes(1)
    scope.stop()
    resolve({ ...status, running: true })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(svc.status).toHaveBeenCalledTimes(1)
  })
})
