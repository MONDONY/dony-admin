import { computed, ref } from 'vue'
import { assistantProviderService } from '@/features/assistant/services/assistantProviderService'
import type { AdminProvider, ProviderPayload, ProviderTestResult } from '@/features/assistant/types'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'

/**
 * Formulaire complet d'un fournisseur, sans clé : en modification, l'absence de `apiKey`
 * laisse la clé enregistrée inchangée côté back.
 */
export function toPayload(p: AdminProvider, patch: Partial<ProviderPayload> = {}): ProviderPayload {
  return {
    name: p.name, baseUrl: p.baseUrl, model: p.model, supportsJsonMode: p.supportsJsonMode,
    dailyRequestLimit: p.dailyRequestLimit, enabled: p.enabled, ...patch,
  }
}

export function useAssistantProviders() {
  const providers = ref<AdminProvider[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)
  const actionError = ref<string | null>(null)
  const testResults = ref<Record<string, ProviderTestResult>>({})
  const testingId = ref<string | null>(null)
  const hasActive = computed(() => providers.value.some((p) => p.enabled))

  async function fetch() {
    isLoading.value = true
    error.value = null
    try {
      providers.value = await assistantProviderService.list()
      unavailable.value = false
    } catch (e) {
      unavailable.value = isEndpointMissing(e)
      if (!unavailable.value) error.value = extractProblemMessage(e, 'Impossible de charger les fournisseurs')
    } finally {
      isLoading.value = false
    }
  }

  async function move(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const previous = providers.value
    const next = [...previous]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return
    next.splice(toIndex, 0, moved)
    providers.value = next
    actionError.value = null
    try {
      providers.value = await assistantProviderService.reorder(next.map((p) => p.id))
    } catch (e) {
      providers.value = previous
      actionError.value = extractProblemMessage(e, "Impossible d'enregistrer le nouvel ordre")
    }
  }

  function replace(p: AdminProvider) {
    const i = providers.value.findIndex((x) => x.id === p.id)
    if (i === -1) providers.value = [...providers.value, p]
    else providers.value = providers.value.map((x) => (x.id === p.id ? p : x))
  }

  async function toggle(p: AdminProvider) {
    actionError.value = null
    try {
      replace(await assistantProviderService.update(p.id, toPayload(p, { enabled: !p.enabled })))
    } catch (e) {
      actionError.value = extractProblemMessage(e, 'Impossible de modifier le fournisseur')
    }
  }

  async function runTest(id: string) {
    testingId.value = id
    try {
      testResults.value = { ...testResults.value, [id]: await assistantProviderService.test(id) }
    } catch (e) {
      testResults.value = {
        ...testResults.value,
        [id]: { ok: false, status: null, latencyMs: 0, sample: null, error: extractProblemMessage(e, 'Test impossible') },
      }
    } finally {
      testingId.value = null
    }
  }

  async function remove(id: string) {
    actionError.value = null
    try {
      await assistantProviderService.remove(id)
      await fetch()
    } catch (e) {
      actionError.value = extractProblemMessage(e, 'Impossible de supprimer le fournisseur')
    }
  }

  return { providers, isLoading, error, unavailable, actionError, testResults, testingId, hasActive, fetch, move, toggle, runTest, remove, replace }
}
