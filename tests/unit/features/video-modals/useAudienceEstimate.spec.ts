import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, effectScope, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
const estimateMock = vi.fn()
vi.mock('@/features/video-modals/services/videoModalService', () => ({ videoModalService: { estimateAudience: (...a: unknown[]) => estimateMock(...a) } }))
import { ESTIMATE_DEBOUNCE_MS, useAudienceEstimate } from '@/features/video-modals/composables/useAudienceEstimate'
import type { AudienceEstimateRequest } from '@/features/video-modals/types/index'

const body = (over: Partial<AudienceEstimateRequest> = {}): AudienceEstimateRequest => ({
  conditions: null, connectedOnly: false, platforms: [], samplePercent: 100, minAppVersion: null, maxAppVersion: null, ...over,
})

function setup(initial: AudienceEstimateRequest | null) {
  const source = ref<AudienceEstimateRequest | null>(initial)
  const scope = effectScope()
  const est = scope.run(() => useAudienceEstimate(source))!
  return { source, est, scope }
}
const wait = (ms = ESTIMATE_DEBOUNCE_MS) => vi.advanceTimersByTimeAsync(ms)

describe('useAudienceEstimate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    estimateMock.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('ciblage incomplet (source nulle) : aucun appel, pas de chargement', async () => {
    const { est } = setup(null)
    await wait()
    expect(estimateMock).not.toHaveBeenCalled()
    expect(est.loading.value).toBe(false)
    expect(est.ready.value).toBe(false)
    expect(est.result.value).toBeNull()
  })

  it('un ciblage complet : chargement tout de suite, un seul appel après le délai, puis le résultat', async () => {
    estimateMock.mockResolvedValue({ accounts: 1180, afterSample: 590 })
    const { est } = setup(body({ samplePercent: 50 }))
    expect(est.loading.value).toBe(true)
    expect(estimateMock).not.toHaveBeenCalled()
    await wait()
    await vi.waitFor(() => expect(est.result.value).toEqual({ accounts: 1180, afterSample: 590 }))
    expect(estimateMock).toHaveBeenCalledTimes(1)
    expect(estimateMock).toHaveBeenCalledWith(body({ samplePercent: 50 }))
    expect(est.loading.value).toBe(false)
    expect(est.error.value).toBeNull()
    expect(est.ready.value).toBe(true)
  })

  it('plusieurs modifications rapprochées : un seul appel, avec la dernière', async () => {
    estimateMock.mockResolvedValue({ accounts: 10, afterSample: 10 })
    const { source } = setup(body())
    await wait(100)
    source.value = body({ samplePercent: 90 })
    await nextTick()
    await wait(100)
    source.value = body({ samplePercent: 80 })
    await nextTick()
    await wait()
    await vi.waitFor(() => expect(estimateMock).toHaveBeenCalledTimes(1))
    expect(estimateMock).toHaveBeenCalledWith(body({ samplePercent: 80 }))
  })

  it('une réponse lente d’un ancien ciblage n’écrase jamais la courante', async () => {
    let resolveOld: (_v: unknown) => void = () => {}
    estimateMock.mockImplementationOnce(() => new Promise((r) => { resolveOld = r }))
    estimateMock.mockResolvedValueOnce({ accounts: 2, afterSample: 2 })
    const { source, est } = setup(body())
    await wait()
    source.value = body({ connectedOnly: true })
    await nextTick()
    await wait()
    await vi.waitFor(() => expect(est.result.value).toEqual({ accounts: 2, afterSample: 2 }))
    resolveOld({ accounts: 999, afterSample: 999 })
    await Promise.resolve()
    expect(est.result.value).toEqual({ accounts: 2, afterSample: 2 })
    expect(est.loading.value).toBe(false)
  })

  it('une réponse lente en erreur d’un ancien ciblage est ignorée aussi', async () => {
    let rejectOld: (_e: unknown) => void = () => {}
    estimateMock.mockImplementationOnce(() => new Promise((_r, rej) => { rejectOld = rej }))
    estimateMock.mockResolvedValueOnce({ accounts: 5, afterSample: 5 })
    const { source, est } = setup(body())
    await wait()
    source.value = body({ platforms: ['IOS'] })
    await nextTick()
    await wait()
    await vi.waitFor(() => expect(est.result.value).not.toBeNull())
    rejectOld(new Error('tard'))
    await Promise.resolve()
    expect(est.error.value).toBeNull()
    expect(est.result.value).toEqual({ accounts: 5, afterSample: 5 })
  })

  it('erreur du back : message du detail RFC 7807, pas de résultat', async () => {
    estimateMock.mockRejectedValue({ data: { detail: 'Condition invalide : champ inconnu' } })
    const { est } = setup(body())
    await wait()
    await vi.waitFor(() => expect(est.error.value).toBe('Condition invalide : champ inconnu'))
    expect(est.result.value).toBeNull()
    expect(est.loading.value).toBe(false)
  })

  it('back qui ne connaît pas encore la route : message par défaut', async () => {
    estimateMock.mockRejectedValue({})
    const { est } = setup(body())
    await wait()
    await vi.waitFor(() => expect(est.error.value).toBe('Estimation indisponible pour le moment'))
  })

  it('« Réessayer » relance tout de suite, sans attendre le délai', async () => {
    estimateMock.mockRejectedValueOnce(new Error('réseau'))
    estimateMock.mockResolvedValueOnce({ accounts: 7, afterSample: 7 })
    const { est } = setup(body())
    await wait()
    await vi.waitFor(() => expect(est.error.value).toBe('réseau'))
    est.refresh()
    await vi.waitFor(() => expect(est.result.value).toEqual({ accounts: 7, afterSample: 7 }))
    expect(est.error.value).toBeNull()
  })

  it('« Réessayer » sans ciblage complet : rien', () => {
    const { est } = setup(null)
    est.refresh()
    expect(estimateMock).not.toHaveBeenCalled()
  })

  it('réponse sans afterSample : il vaut le nombre de comptes', async () => {
    estimateMock.mockResolvedValue({ accounts: 42 })
    const { est } = setup(body())
    await wait()
    await vi.waitFor(() => expect(est.result.value).toEqual({ accounts: 42, afterSample: 42 }))
  })

  it('réponse vide ou illisible : erreur claire', async () => {
    estimateMock.mockResolvedValue(undefined)
    const { est } = setup(body())
    await wait()
    await vi.waitFor(() => expect(est.error.value).toBe('Réponse inattendue du serveur.'))
    expect(est.result.value).toBeNull()
  })

  it('le ciblage redevient incomplet : requête en cours abandonnée, résultat effacé', async () => {
    let resolve: (_v: unknown) => void = () => {}
    estimateMock.mockImplementation(() => new Promise((r) => { resolve = r }))
    const { source, est } = setup(body())
    await wait()
    source.value = null
    await nextTick()
    expect(est.loading.value).toBe(false)
    resolve({ accounts: 3, afterSample: 3 })
    await Promise.resolve()
    expect(est.result.value).toBeNull()
  })

  it('même ciblage réémis (nouvel objet identique) : pas de nouvel appel', async () => {
    estimateMock.mockResolvedValue({ accounts: 1, afterSample: 1 })
    const { source } = setup(body())
    await wait()
    await vi.waitFor(() => expect(estimateMock).toHaveBeenCalledTimes(1))
    source.value = body()
    await nextTick()
    await wait()
    expect(estimateMock).toHaveBeenCalledTimes(1)
  })

  it('composant démonté pendant le délai : aucun appel, et une réponse tardive est ignorée', async () => {
    estimateMock.mockResolvedValue({ accounts: 1, afterSample: 1 })
    const source = ref<AudienceEstimateRequest | null>(body())
    const Probe = defineComponent({
      setup() {
        const est = useAudienceEstimate(source)
        return () => h('span', est.loading.value ? 'chargement' : 'repos')
      },
    })
    const w = mount(Probe)
    expect(w.text()).toBe('chargement')
    w.unmount()
    await wait()
    expect(estimateMock).not.toHaveBeenCalled()
  })

  it('composant démonté pendant l’appel : le résultat n’est pas appliqué', async () => {
    let resolve: (_v: unknown) => void = () => {}
    estimateMock.mockImplementation(() => new Promise((r) => { resolve = r }))
    const source = ref<AudienceEstimateRequest | null>(body())
    let handle!: ReturnType<typeof useAudienceEstimate>
    const Probe = defineComponent({
      setup() {
        handle = useAudienceEstimate(source)
        return () => h('span')
      },
    })
    const w = mount(Probe)
    await wait()
    expect(estimateMock).toHaveBeenCalledTimes(1)
    w.unmount()
    resolve({ accounts: 8, afterSample: 8 })
    await Promise.resolve()
    expect(handle.result.value).toBeNull()
  })
})
