import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { assistantProviderService } from '@/features/assistant/services/assistantProviderService'

const payload = {
  name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama', apiKey: 'gsk_x',
  supportsJsonMode: true, dailyRequestLimit: 1000, enabled: true,
}

describe('assistantProviderService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list fait un GET', async () => {
    apiMock.mockResolvedValue([])
    await assistantProviderService.list()
    expect(apiMock).toHaveBeenCalledWith('/admin/assistant/providers')
  })

  it('create POSTe le formulaire', async () => {
    apiMock.mockResolvedValue({ id: 'p1' })
    await assistantProviderService.create(payload)
    expect(apiMock).toHaveBeenCalledWith('/admin/assistant/providers', { method: 'POST', body: payload })
  })

  it('update PATCHe sans clé quand elle est vide', async () => {
    apiMock.mockResolvedValue({ id: 'p1' })
    await assistantProviderService.update('p1', { ...payload, apiKey: '' })
    const { apiKey, ...rest } = payload
    void apiKey
    expect(apiMock).toHaveBeenCalledWith('/admin/assistant/providers/p1', { method: 'PATCH', body: rest })
  })

  it('create envoie la clé rognée', async () => {
    apiMock.mockResolvedValue({ id: 'p1' })
    await assistantProviderService.create({ ...payload, apiKey: '  gsk_x \n' })
    expect(apiMock).toHaveBeenCalledWith('/admin/assistant/providers', { method: 'POST', body: payload })
  })

  it('create omet une clé blanche', async () => {
    apiMock.mockResolvedValue({ id: 'p1' })
    await assistantProviderService.create({ ...payload, apiKey: '   ' })
    const { apiKey, ...rest } = payload
    void apiKey
    expect(apiMock).toHaveBeenCalledWith('/admin/assistant/providers', { method: 'POST', body: rest })
  })

  it('update envoie la clé rognée', async () => {
    apiMock.mockResolvedValue({ id: 'p1' })
    await assistantProviderService.update('p1', { ...payload, apiKey: '  gsk_x  ' })
    expect(apiMock).toHaveBeenCalledWith('/admin/assistant/providers/p1', { method: 'PATCH', body: payload })
  })

  it.each([['blanche', '   '], ['absente', undefined]])('update omet une clé %s', async (_l, apiKey) => {
    apiMock.mockResolvedValue({ id: 'p1' })
    await assistantProviderService.update('p1', { ...payload, apiKey })
    const { apiKey: _k, ...rest } = payload
    void _k
    expect(apiMock).toHaveBeenCalledWith('/admin/assistant/providers/p1', { method: 'PATCH', body: rest })
  })

  it('reorder PUTe la liste des ids', async () => {
    apiMock.mockResolvedValue([])
    await assistantProviderService.reorder(['b', 'a'])
    expect(apiMock).toHaveBeenCalledWith('/admin/assistant/providers/order', { method: 'PUT', body: { ids: ['b', 'a'] } })
  })

  it('test POSTe sur /test', async () => {
    apiMock.mockResolvedValue({ ok: true })
    await assistantProviderService.test('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/assistant/providers/p1/test', { method: 'POST' })
  })

  it('remove fait un DELETE', async () => {
    apiMock.mockResolvedValue(undefined)
    await assistantProviderService.remove('p1')
    expect(apiMock).toHaveBeenCalledWith('/admin/assistant/providers/p1', { method: 'DELETE' })
  })
})

// Le back sérialise en NON_NULL : un champ nul n'arrive pas, il vaut undefined côté admin.
// Sans normalisation, l'état affichait « Erreur undefined » et la limite « / undefined ».
describe('assistantProviderService, champs nuls omis par le back', () => {
  beforeEach(() => apiMock.mockReset())

  const sparse = {
    id: 'p1', name: 'OpenRouter', slug: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'm',
    apiKeyLast4: '4659', supportsJsonMode: true, priority: 1, enabled: true,
    stats: { requestsToday: 0, successesToday: 0 },
  }
  const filled = {
    ...sparse,
    dailyRequestLimit: null,
    stats: { requestsToday: 0, successesToday: 0, lastStatus: null, lastError: null, cooldownUntil: null },
  }

  it('list remet les champs absents à null', async () => {
    apiMock.mockResolvedValue([sparse])
    expect(await assistantProviderService.list()).toEqual([filled])
  })

  it('list garde les valeurs présentes', async () => {
    const full = { ...sparse, dailyRequestLimit: 500, stats: { requestsToday: 3, successesToday: 2, lastStatus: 429, lastError: 'quota', cooldownUntil: '2026-10-16T14:00:00Z' } }
    apiMock.mockResolvedValue([full])
    expect(await assistantProviderService.list()).toEqual([full])
  })

  it('create, update et reorder normalisent aussi', async () => {
    apiMock.mockResolvedValue(sparse)
    expect(await assistantProviderService.create(payload)).toEqual(filled)
    expect(await assistantProviderService.update('p1', payload)).toEqual(filled)
    apiMock.mockResolvedValue([sparse])
    expect(await assistantProviderService.reorder(['p1'])).toEqual([filled])
  })

  it('test remet status, sample et error absents à null', async () => {
    apiMock.mockResolvedValue({ ok: true, latencyMs: 566 })
    expect(await assistantProviderService.test('p1')).toEqual({ ok: true, status: null, latencyMs: 566, sample: null, error: null })
  })
})
