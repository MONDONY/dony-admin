import { describe, it, expect, vi, beforeEach } from 'vitest'

const svc = vi.hoisted(() => ({
  list: vi.fn(), create: vi.fn(), update: vi.fn(), reorder: vi.fn(), test: vi.fn(), remove: vi.fn(),
}))
vi.mock('@/features/assistant/services/assistantProviderService', () => ({ assistantProviderService: svc }))

import { useAssistantProviders } from '@/features/assistant/composables/useAssistantProviders'
import type { AdminProvider } from '@/features/assistant/types'

const p = (id: string, enabled = true): AdminProvider => ({
  id, name: id, slug: id, baseUrl: 'https://a.com', model: 'm', apiKeyLast4: '1234', supportsJsonMode: true,
  dailyRequestLimit: null, priority: 1, enabled,
  stats: { requestsToday: 0, successesToday: 0, lastStatus: null, lastError: null, cooldownUntil: null },
})
const httpError = (status: number, data?: Record<string, unknown>) => Object.assign(new Error(`${status}`), { statusCode: status, data })

describe('useAssistantProviders', () => {
  beforeEach(() => Object.values(svc).forEach((f) => f.mockReset()))

  it('charge la liste', async () => {
    svc.list.mockResolvedValue([p('a'), p('b')])
    const s = useAssistantProviders()
    await s.fetch()
    expect(s.providers.value.map((x) => x.id)).toEqual(['a', 'b'])
    expect(s.hasActive.value).toBe(true)
  })

  it('back pas déployé', async () => {
    svc.list.mockRejectedValue(httpError(404))
    const s = useAssistantProviders()
    await s.fetch()
    expect(s.unavailable.value).toBe(true)
  })

  it('erreur de chargement', async () => {
    svc.list.mockRejectedValue(httpError(500, { detail: 'Panne' }))
    const s = useAssistantProviders()
    await s.fetch()
    expect(s.error.value).toBe('Panne')
  })

  it('move envoie le nouvel ordre et garde la réponse serveur', async () => {
    svc.list.mockResolvedValue([p('a'), p('b'), p('c')])
    svc.reorder.mockResolvedValue([p('c'), p('a'), p('b')])
    const s = useAssistantProviders()
    await s.fetch()
    await s.move(2, 0)
    expect(svc.reorder).toHaveBeenCalledWith(['c', 'a', 'b'])
    expect(s.providers.value.map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })

  it('move rétablit l’ordre en cas d’échec', async () => {
    svc.list.mockResolvedValue([p('a'), p('b')])
    svc.reorder.mockRejectedValue(httpError(422, { detail: 'Ordre invalide' }))
    const s = useAssistantProviders()
    await s.fetch()
    await s.move(1, 0)
    expect(s.providers.value.map((x) => x.id)).toEqual(['a', 'b'])
    expect(s.actionError.value).toBe('Ordre invalide')
  })

  it('move sans effet sur la même position', async () => {
    svc.list.mockResolvedValue([p('a')])
    const s = useAssistantProviders()
    await s.fetch()
    await s.move(0, 0)
    expect(svc.reorder).not.toHaveBeenCalled()
  })

  it('toggle envoie le formulaire complet sans clé', async () => {
    svc.list.mockResolvedValue([p('a')])
    svc.update.mockResolvedValue(p('a', false))
    const s = useAssistantProviders()
    await s.fetch()
    await s.toggle(s.providers.value[0]!)
    expect(svc.update).toHaveBeenCalledWith('a', expect.objectContaining({ enabled: false, baseUrl: 'https://a.com' }))
    expect(svc.update.mock.calls[0]![1]).not.toHaveProperty('apiKey')
    expect(s.hasActive.value).toBe(false)
  })

  it('runTest garde le résultat par fournisseur', async () => {
    svc.test.mockResolvedValue({ ok: true, status: 200, latencyMs: 820, sample: 'ok', error: null })
    const s = useAssistantProviders()
    await s.runTest('a')
    expect(s.testResults.value.a?.latencyMs).toBe(820)
    expect(s.testingId.value).toBeNull()
  })

  it('remove recharge la liste', async () => {
    svc.list.mockResolvedValueOnce([p('a')]).mockResolvedValueOnce([])
    svc.remove.mockResolvedValue(undefined)
    const s = useAssistantProviders()
    await s.fetch()
    await s.remove('a')
    expect(s.providers.value).toEqual([])
  })

  it('replace met à jour une ligne ou l’ajoute', async () => {
    const s = useAssistantProviders()
    s.replace(p('a'))
    s.replace({ ...p('a'), name: 'A2' })
    expect(s.providers.value).toHaveLength(1)
    expect(s.providers.value[0]!.name).toBe('A2')
  })
})

describe('useAssistantProviders, chemins d’erreur', () => {
  beforeEach(() => Object.values(svc).forEach((f) => f.mockReset()))

  it('toggle en échec garde la ligne et affiche le message', async () => {
    svc.list.mockResolvedValue([p('a')])
    svc.update.mockRejectedValue(httpError(422, { detail: 'Clé requise' }))
    const s = useAssistantProviders()
    await s.fetch()
    await s.toggle(s.providers.value[0]!)
    expect(s.providers.value[0]!.enabled).toBe(true)
    expect(s.actionError.value).toBe('Clé requise')
  })

  it('runTest en échec enregistre l’erreur du test', async () => {
    svc.test.mockRejectedValue(httpError(500, { detail: 'Hors ligne' }))
    const s = useAssistantProviders()
    await s.runTest('a')
    expect(s.testResults.value.a).toEqual({ ok: false, status: null, latencyMs: 0, sample: null, error: 'Hors ligne' })
    expect(s.testingId.value).toBeNull()
  })

  it('remove en échec affiche le message sans recharger la liste', async () => {
    svc.list.mockResolvedValue([p('a')])
    svc.remove.mockRejectedValue(httpError(404, { code: 'assistant-provider-not-found', detail: 'Introuvable' }))
    const s = useAssistantProviders()
    await s.fetch()
    await s.remove('a')
    expect(s.actionError.value).toBe('Introuvable')
    expect(svc.list).toHaveBeenCalledTimes(1)
  })

  it('une erreur autre que 404 n’active pas l’état indisponible', async () => {
    svc.list.mockRejectedValueOnce(httpError(404)).mockRejectedValueOnce(httpError(500, { detail: 'Panne' }))
    const s = useAssistantProviders()
    await s.fetch()
    expect(s.unavailable.value).toBe(true)
    await s.fetch()
    expect(s.unavailable.value).toBe(false)
    expect(s.error.value).toBe('Panne')
  })

  it('move hors bornes ne touche à rien', async () => {
    svc.list.mockResolvedValue([p('a'), p('b')])
    const s = useAssistantProviders()
    await s.fetch()
    await s.move(5, 0)
    expect(svc.reorder).not.toHaveBeenCalled()
    expect(s.providers.value.map((x) => x.id)).toEqual(['a', 'b'])
  })

  describe('move : garde et bornes', () => {
    it('ignore un second move tant que le premier n’a pas répondu', async () => {
      svc.list.mockResolvedValue([p('a'), p('b'), p('c')])
      let resolve: (_v: AdminProvider[]) => void = () => {}
      svc.reorder.mockReturnValue(new Promise((r) => { resolve = r }))
      const s = useAssistantProviders()
      await s.fetch()
      const first = s.move(0, 1)
      expect(s.isMoving.value).toBe(true)
      await s.move(1, 2)
      expect(svc.reorder).toHaveBeenCalledTimes(1)
      resolve([p('b'), p('a'), p('c')])
      await first
      expect(s.isMoving.value).toBe(false)
      expect(s.providers.value.map((x) => x.id)).toEqual(['b', 'a', 'c'])
    })

    it('isMoving retombe aussi après un refus du serveur', async () => {
      svc.list.mockResolvedValue([p('a'), p('b')])
      svc.reorder.mockRejectedValue(httpError(500))
      const s = useAssistantProviders()
      await s.fetch()
      await s.move(0, 1)
      expect(s.isMoving.value).toBe(false)
      expect(s.providers.value.map((x) => x.id)).toEqual(['a', 'b'])
    })

    it.each([[-1, 0], [0, 9], [0, -1], [5, 0], [0, 2]])('move(%i, %i) hors bornes : aucun effet', async (from, to) => {
      svc.list.mockResolvedValue([p('a'), p('b')])
      const s = useAssistantProviders()
      await s.fetch()
      await s.move(from, to)
      expect(svc.reorder).not.toHaveBeenCalled()
      expect(s.providers.value.map((x) => x.id)).toEqual(['a', 'b'])
    })
  })

  it('remove réussi retire aussi le résultat de test du fournisseur supprimé', async () => {
    svc.list.mockResolvedValueOnce([p('a'), p('b')]).mockResolvedValueOnce([p('b')])
    svc.test.mockResolvedValue({ ok: true, status: 200, latencyMs: 5, sample: 'ok', error: null })
    svc.remove.mockResolvedValue(undefined)
    const s = useAssistantProviders()
    await s.fetch()
    await s.runTest('a')
    await s.runTest('b')
    await s.remove('a')
    expect(Object.keys(s.testResults.value)).toEqual(['b'])
  })

  it('remove refusé garde le résultat de test', async () => {
    svc.list.mockResolvedValue([p('a')])
    svc.test.mockResolvedValue({ ok: true, status: 200, latencyMs: 5, sample: 'ok', error: null })
    svc.remove.mockRejectedValue(httpError(500))
    const s = useAssistantProviders()
    await s.fetch()
    await s.runTest('a')
    await s.remove('a')
    expect(Object.keys(s.testResults.value)).toEqual(['a'])
  })
})
