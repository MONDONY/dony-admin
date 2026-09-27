import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/package-requests/services/packageRequestsService', () => ({
  packageRequestsService: { list: vi.fn(), get: vi.fn(), remove: vi.fn(), restore: vi.fn() },
}))
import { usePackageRequestDetail } from '@/features/package-requests/composables/usePackageRequestDetail'
import { packageRequestsService } from '@/features/package-requests/services/packageRequestsService'
const svc = vi.mocked(packageRequestsService)

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'pr1', status: 'OPEN', canRemove: true, removeBlockedReason: null, canRestore: false,
  photos: [], negotiations: [], reports: [], ...over,
}) as never
const problem = (status: number, code: string | undefined, text: string) =>
  Object.assign(new Error(`[POST] ${status}`), { statusCode: status, data: { code, detail: text } })

describe('usePackageRequestDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('open charge le détail', async () => {
    svc.get.mockResolvedValue(detail())
    const d = usePackageRequestDetail()
    await d.open('pr1')
    expect(svc.get).toHaveBeenCalledWith('pr1')
    expect(d.request.value?.id).toBe('pr1')
    expect(d.isLoading.value).toBe(false)
  })

  it('open en échec : message du ProblemDetail, fiche vide', async () => {
    svc.get.mockRejectedValue(problem(404, 'package-request-not-found', 'Demande introuvable'))
    const d = usePackageRequestDetail()
    await d.open('zz')
    expect(d.request.value).toBeNull()
    expect(d.error.value).toBe('Demande introuvable')
  })

  it('open sur un ancien back (404 sans code) : indisponible', async () => {
    svc.get.mockRejectedValue(problem(404, undefined, 'No endpoint'))
    const d = usePackageRequestDetail()
    await d.open('pr1')
    expect(d.error.value).toBe('Modération des demandes indisponible pour le moment')
  })

  it('open sans detail : repli', async () => {
    svc.get.mockRejectedValue({})
    const d = usePackageRequestDetail()
    await d.open('pr1')
    expect(d.error.value).toBe('Impossible de charger la demande')
  })

  it('close vide l’état', async () => {
    svc.get.mockResolvedValue(detail())
    const d = usePackageRequestDetail()
    await d.open('pr1')
    d.close()
    expect(d.request.value).toBeNull()
    expect(d.openId.value).toBeNull()
    expect(d.actionError.value).toBeNull()
  })

  it('remove transmet le motif public et la note, remplace la fiche et la rend', async () => {
    svc.get.mockResolvedValue(detail())
    const removed = detail({ status: 'REMOVED_BY_ADMIN', canRemove: false, canRestore: true })
    svc.remove.mockResolvedValue(removed)
    const d = usePackageRequestDetail()
    await d.open('pr1')
    const res = await d.remove('SUSPECTED_FRAUD', 'ticket #12')
    expect(svc.remove).toHaveBeenCalledWith('pr1', 'SUSPECTED_FRAUD', 'ticket #12')
    expect(res).toEqual(removed)
    expect(d.request.value?.status).toBe('REMOVED_BY_ADMIN')
    expect(d.busy.value).toBe(false)
  })

  it('busy pendant l’appel', async () => {
    svc.get.mockResolvedValue(detail())
    let done!: (_v: unknown) => void
    svc.remove.mockReturnValue(new Promise((r) => { done = r }) as never)
    const d = usePackageRequestDetail()
    await d.open('pr1')
    const p = d.remove('OTHER', '')
    expect(d.busy.value).toBe(true)
    done(detail({ status: 'REMOVED_BY_ADMIN' }))
    await p
    expect(d.busy.value).toBe(false)
  })

  it('409 envoi en cours : le detail (qui renvoie vers les litiges) est affiché, la fiche reste', async () => {
    svc.get.mockResolvedValue(detail())
    svc.remove.mockRejectedValue(problem(409, 'package-request-has-active-shipment', 'Un envoi est en cours : ouvrez un litige.'))
    const d = usePackageRequestDetail()
    await d.open('pr1')
    const res = await d.remove('OTHER', '')
    expect(res).toBeNull()
    expect(d.actionError.value).toBe('Un envoi est en cours : ouvrez un litige.')
    expect(d.actionErrorCode.value).toBe('package-request-has-active-shipment')
    expect(d.request.value?.status).toBe('OPEN')
    expect(svc.get).toHaveBeenCalledTimes(1)
  })

  it('409 déjà retirée : la fiche est relue pour se resynchroniser', async () => {
    svc.get.mockResolvedValueOnce(detail()).mockResolvedValueOnce(detail({ status: 'REMOVED_BY_ADMIN', canRestore: true }))
    svc.remove.mockRejectedValue(problem(409, 'package-request-already-removed', 'Déjà retirée.'))
    const d = usePackageRequestDetail()
    await d.open('pr1')
    await d.remove('OTHER', '')
    expect(d.actionError.value).toBe('Déjà retirée.')
    expect(svc.get).toHaveBeenCalledTimes(2)
    expect(d.request.value?.status).toBe('REMOVED_BY_ADMIN')
  })

  it('restore rend la fiche restaurée', async () => {
    svc.get.mockResolvedValue(detail({ status: 'REMOVED_BY_ADMIN', canRestore: true }))
    svc.restore.mockResolvedValue(detail({ status: 'OPEN' }))
    const d = usePackageRequestDetail()
    await d.open('pr1')
    const res = await d.restore()
    expect(svc.restore).toHaveBeenCalledWith('pr1')
    expect(res?.status).toBe('OPEN')
    expect(d.actionError.value).toBeNull()
  })

  it('restore 409 non retirée : message et resynchronisation', async () => {
    svc.get.mockResolvedValueOnce(detail({ status: 'REMOVED_BY_ADMIN', canRestore: true })).mockResolvedValueOnce(detail())
    svc.restore.mockRejectedValue(problem(409, 'package-request-not-removed', 'Cette demande n’est pas retirée.'))
    const d = usePackageRequestDetail()
    await d.open('pr1')
    expect(await d.restore()).toBeNull()
    expect(d.actionError.value).toBe('Cette demande n’est pas retirée.')
    expect(d.request.value?.status).toBe('OPEN')
  })

  it('action sans fiche ouverte : rien', async () => {
    const d = usePackageRequestDetail()
    expect(await d.remove('OTHER', '')).toBeNull()
    expect(await d.restore()).toBeNull()
    expect(svc.remove).not.toHaveBeenCalled()
    expect(svc.restore).not.toHaveBeenCalled()
  })

  it('une nouvelle action efface l’erreur précédente ; repli sans detail', async () => {
    svc.get.mockResolvedValue(detail())
    svc.remove.mockRejectedValueOnce({})
    svc.remove.mockResolvedValueOnce(detail({ status: 'REMOVED_BY_ADMIN' }))
    const d = usePackageRequestDetail()
    await d.open('pr1')
    await d.remove('OTHER', '')
    expect(d.actionError.value).toBe('Action échouée')
    await d.remove('OTHER', '')
    expect(d.actionError.value).toBeNull()
    expect(d.actionErrorCode.value).toBeNull()
  })

  it('une réponse arrivée après fermeture ne rouvre pas la fiche', async () => {
    let done!: (_v: unknown) => void
    svc.get.mockReturnValue(new Promise((r) => { done = r }) as never)
    const d = usePackageRequestDetail()
    const p = d.open('pr1')
    d.close()
    done(detail())
    await p
    expect(d.request.value).toBeNull()
  })
})
