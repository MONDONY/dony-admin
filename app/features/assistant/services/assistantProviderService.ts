import { useApi } from '@/composables/useApi'
import type { AdminProvider, ProviderPayload, ProviderTestResult } from '@/features/assistant/types'

const BASE = '/admin/assistant/providers'

/** Clé rognée ; une clé absente ou blanche est omise (en modification, le back garde alors la clé enregistrée). */
function toBody(payload: ProviderPayload): ProviderPayload {
  const { apiKey, ...rest } = payload
  const key = apiKey?.trim()
  return key ? { ...rest, apiKey: key } : rest
}

export const assistantProviderService = {
  list(): Promise<AdminProvider[]> {
    return useApi()<AdminProvider[]>(BASE)
  },
  create(payload: ProviderPayload): Promise<AdminProvider> {
    return useApi()<AdminProvider>(BASE, { method: 'POST', body: toBody(payload) })
  },
  update(id: string, payload: ProviderPayload): Promise<AdminProvider> {
    return useApi()<AdminProvider>(`${BASE}/${id}`, { method: 'PATCH', body: toBody(payload) })
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
