import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useReportContext } from '@/features/signalements/composables/useReportContext'
import { reportsService } from '@/features/signalements/services/reportsService'

vi.mock('@/features/signalements/services/reportsService', () => ({
  reportsService: { getContext: vi.fn() },
}))
const getContext = vi.mocked(reportsService.getContext)

function deferred<T>() {
  let resolve!: (_value: T) => void
  let reject!: (_error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('useReportContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('charge le contexte du dossier', async () => {
    getContext.mockResolvedValue({ messagesRestricted: false, history: [], relatedReports: [] })
    const c = useReportContext()
    const pending = c.load('r1')
    expect(c.isLoading.value).toBe(true)
    await pending
    expect(getContext).toHaveBeenCalledWith('r1')
    expect(c.context.value).toEqual({ messagesRestricted: false, history: [], relatedReports: [] })
    expect(c.isLoading.value).toBe(false)
    expect(c.error.value).toBeNull()
  })

  it('un autre dossier repart de zéro pendant le chargement', async () => {
    getContext.mockResolvedValueOnce({ messagesRestricted: false, reporter: { userId: 'u', totalReports: 1, resolvedReports: 0, dismissedReports: 0 } })
    const c = useReportContext()
    await c.load('r1')
    const next = deferred<never>()
    getContext.mockReturnValueOnce(next.promise)
    const pending = c.load('r2')
    expect(c.context.value).toBeNull()
    next.resolve({ messagesRestricted: false } as never)
    await pending
  })

  it('J / K enchaînés : la réponse d’un dossier quitté est ignorée', async () => {
    const first = deferred<{ messagesRestricted: boolean }>()
    const second = deferred<{ messagesRestricted: boolean }>()
    getContext.mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never)
    const c = useReportContext()
    const p1 = c.load('r1')
    const p2 = c.load('r2')
    second.resolve({ messagesRestricted: true })
    await p2
    first.resolve({ messagesRestricted: false })
    await p1
    expect(c.context.value).toEqual({ messagesRestricted: true })
    expect(c.isLoading.value).toBe(false)
  })

  it('l’échec d’un dossier quitté n’affiche rien sur le dossier courant', async () => {
    const first = deferred<never>()
    const second = deferred<{ messagesRestricted: boolean }>()
    getContext.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise as never)
    const c = useReportContext()
    const p1 = c.load('r1')
    const p2 = c.load('r2')
    first.reject({ statusCode: 500 })
    await p1
    second.resolve({ messagesRestricted: false })
    await p2
    expect(c.error.value).toBeNull()
    expect(c.context.value).toEqual({ messagesRestricted: false })
  })

  it('ancien back (404 sans code) : indisponible, sans erreur à montrer', async () => {
    getContext.mockRejectedValue({ statusCode: 404, data: {} })
    const c = useReportContext()
    await c.load('r1')
    expect(c.unavailable.value).toBe(true)
    expect(c.error.value).toBeNull()
    expect(c.context.value).toBeNull()
  })

  it('un 404 avec code métier est une vraie erreur : signalement supprimé entre-temps', async () => {
    getContext.mockRejectedValue({ statusCode: 404, data: { code: 'report-not-found', detail: 'Signalement introuvable' } })
    const c = useReportContext()
    await c.load('r1')
    expect(c.unavailable.value).toBe(false)
    expect(c.error.value).toBe('Signalement introuvable')
  })

  it('une erreur inattendue laisse une phrase, le contexte reste vide', async () => {
    getContext.mockRejectedValue({ statusCode: 500 })
    const c = useReportContext()
    await c.load('r1')
    expect(c.error.value).toBe('Contexte indisponible')
    expect(c.context.value).toBeNull()
    expect(c.isLoading.value).toBe(false)
  })

  it('un succès après un ancien back disponible : indisponible retombe', async () => {
    getContext.mockRejectedValueOnce({ statusCode: 404, data: {} })
    const c = useReportContext()
    await c.load('r1')
    expect(c.unavailable.value).toBe(true)
    getContext.mockResolvedValueOnce({ messagesRestricted: false })
    await c.load('r2')
    expect(c.unavailable.value).toBe(false)
  })

  it('une réponse d’une autre forme n’est pas un contexte : ignorée sans bruit', async () => {
    getContext.mockResolvedValue({ content: [], totalElements: 0 } as never)
    const c = useReportContext()
    await c.load('r1')
    expect(c.context.value).toBeNull()
    expect(c.unavailable.value).toBe(true)
    expect(c.error.value).toBeNull()
    getContext.mockResolvedValue(null as never)
    await c.load('r2')
    expect(c.context.value).toBeNull()
  })

  it('aucun dossier : vide tout, sans appel', async () => {
    getContext.mockResolvedValue({ messagesRestricted: false })
    const c = useReportContext()
    await c.load('r1')
    await c.load(null)
    expect(getContext).toHaveBeenCalledTimes(1)
    expect(c.context.value).toBeNull()
    expect(c.isLoading.value).toBe(false)
  })

  it('clear() abandonne une lecture en cours', async () => {
    const pending = deferred<{ messagesRestricted: boolean }>()
    getContext.mockReturnValueOnce(pending.promise as never)
    const c = useReportContext()
    const p = c.load('r1')
    c.clear()
    pending.resolve({ messagesRestricted: false })
    await p
    expect(c.context.value).toBeNull()
    expect(c.isLoading.value).toBe(false)
  })
})
