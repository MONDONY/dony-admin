import { useApi } from '@/composables/useApi'
import type { AdminProvider, ProviderPayload, ProviderTestResult } from '@/features/assistant/types'

const BASE = '/admin/assistant/providers'

export const assistantProviderService = {
  list(): Promise<AdminProvider[]> {
    return useApi()<AdminProvider[]>(BASE)
  },
  create(payload: ProviderPayload): Promise<AdminProvider> {
    return useApi()<AdminProvider>(BASE, { method: 'POST', body: payload })
  },
  update(id: string, payload: ProviderPayload): Promise<AdminProvider> {
    const { apiKey, ...rest } = payload
    const body = apiKey && apiKey.trim() ? { ...rest, apiKey } : rest
    return useApi()<AdminProvider>(`${BASE}/${id}`, { method: 'PATCH', body })
  },
  reorder(ids: string[]): Promise<AdminProvider[]> {
    return useApi()<AdminProvider[]>(`${BASE}/order`, { method: 'PUT', body: { ids } })
  },
  test(id: string): Promise<ProviderTestResult> {
    return useApi()<ProviderTestResult>(`${BASE}/${id}/test`, { method: 'POST' })
  },
  remove(id: string): Promise<void> {
    return useApi()<void>(`${BASE}/${id}`, { method: 'DELETE' })
  },
}
