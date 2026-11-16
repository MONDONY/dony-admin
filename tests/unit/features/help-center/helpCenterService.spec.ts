import { describe, it, expect, vi, beforeEach } from 'vitest'

const api = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => api }))

import { helpCenterService } from '@/features/help-center/services/helpCenterService'

describe('helpCenterService', () => {
  beforeEach(() => api.mockReset())

  it('contents remet les permissions absentes à null', async () => {
    api.mockResolvedValue({ categories: [], assistantEnabled: true, articles: [{ id: 'a' }, { id: 'b', permission: 'BID_VIEW' }] })
    const c = await helpCenterService.contents()
    expect(api).toHaveBeenCalledWith('/admin/help/articles')
    expect(c.articles.map(a => a.permission)).toEqual([null, 'BID_VIEW'])
  })

  it('article encode l’identifiant et normalise les fiches proches', async () => {
    api.mockResolvedValue({ id: 'a b', related: [{ id: 'r' }] })
    const a = await helpCenterService.article('a b')
    expect(api).toHaveBeenCalledWith('/admin/help/articles/a%20b')
    expect(a.permission).toBeNull()
    expect(a.related[0]!.permission).toBeNull()
    api.mockResolvedValue({ id: 'c' })
    expect((await helpCenterService.article('c')).related).toEqual([])
  })

  it('search et ask', async () => {
    api.mockResolvedValue({ query: 'x', results: [] })
    await helpCenterService.search('x')
    expect(api).toHaveBeenCalledWith('/admin/help/search', { query: { q: 'x' } })
    api.mockResolvedValue({})
    await helpCenterService.ask('q', [{ role: 'user', text: 't' }])
    expect(api).toHaveBeenCalledWith('/admin/help/ask', { method: 'POST', body: { question: 'q', history: [{ role: 'user', text: 't' }] } })
  })
})
