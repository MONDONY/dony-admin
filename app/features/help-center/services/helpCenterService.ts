import { useApi } from '@/composables/useApi'
import type { HelpArticle, HelpAskResponse, HelpContents, HelpSearchResponse, HelpTurn } from '@/features/help-center/types'

const BASE = '/admin/help'

/** Le back sérialise en NON_NULL : une permission absente arrive undefined, on la remet à null. */
function withNullPermission<T extends { permission?: string | null }>(a: T): T {
  return { ...a, permission: a.permission ?? null }
}

export const helpCenterService = {
  contents(): Promise<HelpContents> {
    return useApi()<HelpContents>(`${BASE}/articles`).then(c => ({
      ...c, articles: c.articles.map(withNullPermission),
    }))
  },
  article(id: string): Promise<HelpArticle> {
    return useApi()<HelpArticle>(`${BASE}/articles/${encodeURIComponent(id)}`).then(a => ({
      ...withNullPermission(a), related: (a.related ?? []).map(withNullPermission),
    }))
  },
  search(q: string): Promise<HelpSearchResponse> {
    return useApi()<HelpSearchResponse>(`${BASE}/search`, { query: { q } })
  },
  ask(question: string, history: HelpTurn[]): Promise<HelpAskResponse> {
    return useApi()<HelpAskResponse>(`${BASE}/ask`, { method: 'POST', body: { question, history } })
  },
}
