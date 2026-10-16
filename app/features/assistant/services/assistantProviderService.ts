import { useApi } from '@/composables/useApi'
import type { AdminProvider, ProviderPayload, ProviderTestResult } from '@/features/assistant/types'

const BASE = '/admin/assistant/providers'

/** Clé rognée ; une clé absente ou blanche est omise (en modification, le back garde alors la clé enregistrée). */
function toBody(payload: ProviderPayload): ProviderPayload {
  const { apiKey, ...rest } = payload
  const key = apiKey?.trim()
  return key ? { ...rest, apiKey: key } : rest
}

/**
 * Le back sérialise en NON_NULL : un champ nul n'est pas envoyé et arrive undefined.
 * On le remet à null pour que les tests `=== null` des composants restent justes
 * (sans quoi l'état affichait « Erreur undefined »).
 */
function normalize(p: AdminProvider): AdminProvider {
  const s = p.stats
  return {
    ...p,
    dailyRequestLimit: p.dailyRequestLimit ?? null,
    ...(s && {
      stats: {
        ...s,
        lastStatus: s.lastStatus ?? null,
        lastError: s.lastError ?? null,
        cooldownUntil: s.cooldownUntil ?? null,
      },
    }),
  }
}

function normalizeTest(r: ProviderTestResult): ProviderTestResult {
  return { ...r, status: r.status ?? null, sample: r.sample ?? null, error: r.error ?? null }
}

export const assistantProviderService = {
  list(): Promise<AdminProvider[]> {
    return useApi()<AdminProvider[]>(BASE).then(list => list.map(normalize))
  },
  create(payload: ProviderPayload): Promise<AdminProvider> {
    return useApi()<AdminProvider>(BASE, { method: 'POST', body: toBody(payload) }).then(normalize)
  },
  update(id: string, payload: ProviderPayload): Promise<AdminProvider> {
    return useApi()<AdminProvider>(`${BASE}/${id}`, { method: 'PATCH', body: toBody(payload) }).then(normalize)
  },
  reorder(ids: string[]): Promise<AdminProvider[]> {
    return useApi()<AdminProvider[]>(`${BASE}/order`, { method: 'PUT', body: { ids } }).then(list => list.map(normalize))
  },
  test(id: string): Promise<ProviderTestResult> {
    return useApi()<ProviderTestResult>(`${BASE}/${id}/test`, { method: 'POST' }).then(normalizeTest)
  },
  remove(id: string): Promise<void> {
    return useApi()<void>(`${BASE}/${id}`, { method: 'DELETE' })
  },
}
