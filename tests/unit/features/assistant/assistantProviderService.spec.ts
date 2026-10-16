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
