import { computed, ref } from 'vue'
import { assistantProviderService } from '@/features/assistant/services/assistantProviderService'
import type { AdminProvider, ProviderPayload, ProviderTestResult } from '@/features/assistant/types'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'

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
  // Plusieurs tests peuvent tourner en même temps : un identifiant par test en cours.
  const testingIds = ref<Set<string>>(new Set())
  const isMoving = ref(false)
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

  /**
   * Rechargement silencieux après un échec : pas d'état « Chargement… », et un échec ici garde la liste
   * affichée (le message de l'action reste, c'est lui que l'administrateur doit lire).
   */
  async function refresh() {
    try {
      providers.value = await assistantProviderService.list()
    } catch {
      // La liste affichée reste celle d'avant.
    }
  }

  /** Le fournisseur a disparu entre-temps (supprimé depuis un autre onglet) : la liste affichée est périmée. */
  function isGone(e: unknown): boolean {
    return problemCode(e) === 'assistant-provider-not-found'
  }

  async function move(fromIndex: number, toIndex: number) {
    const last = providers.value.length - 1
    // Un envoi d'ordre à la fois, et des indices dans la liste : sinon deux requêtes se chevauchent ou splice corrompt la liste.
    if (isMoving.value || fromIndex === toIndex) return
    if (fromIndex < 0 || fromIndex > last || toIndex < 0 || toIndex > last) return
    const previous = providers.value
    const next = [...previous]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return
    next.splice(toIndex, 0, moved)
    providers.value = next
    actionError.value = null
    isMoving.value = true
    try {
      providers.value = await assistantProviderService.reorder(next.map((p) => p.id))
    } catch (e) {
      providers.value = previous
      actionError.value = extractProblemMessage(e, "Impossible d'enregistrer le nouvel ordre")
      await refresh()
    } finally {
      isMoving.value = false
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
      if (isGone(e)) await refresh()
    }
  }

  async function runTest(id: string) {
    if (testingIds.value.has(id)) return
    testingIds.value = new Set([...testingIds.value, id])
    let gone = false
    try {
      // L'attente d'abord : copier testResults avant l'await écraserait le résultat d'un test terminé entre-temps.
      const result = await assistantProviderService.test(id)
      testResults.value = { ...testResults.value, [id]: result }
    } catch (e) {
      gone = isGone(e)
      testResults.value = {
        ...testResults.value,
        [id]: { ok: false, status: null, latencyMs: 0, sample: null, error: extractProblemMessage(e, 'Test impossible') },
      }
    } finally {
      testingIds.value = new Set([...testingIds.value].filter((x) => x !== id))
    }
    if (gone) await refresh()
  }

  function discardTestResult(id: string) {
    testResults.value = Object.fromEntries(Object.entries(testResults.value).filter(([key]) => key !== id))
  }

  async function remove(id: string) {
    actionError.value = null
    try {
      await assistantProviderService.remove(id)
    } catch (e) {
      actionError.value = extractProblemMessage(e, 'Impossible de supprimer le fournisseur')
      if (isGone(e)) await refresh()
      return
    }
    // La ligne part tout de suite ; le rechargement qui suit remet les priorités à jour sans masquer le tableau.
    providers.value = providers.value.filter((p) => p.id !== id)
    discardTestResult(id)
    await refresh()
  }

  return { providers, isLoading, error, unavailable, actionError, testResults, testingIds, isMoving, hasActive, fetch, move, toggle, runTest, discardTestResult, remove, replace }
}
