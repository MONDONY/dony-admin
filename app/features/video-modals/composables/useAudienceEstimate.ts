import { computed, getCurrentInstance, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { videoModalService } from '@/features/video-modals/services/videoModalService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AudienceEstimate, AudienceEstimateRequest } from '@/features/video-modals/types/index'

/** Délai après la dernière modification du ciblage avant de recalculer l'estimation (comme Communications). */
export const ESTIMATE_DEBOUNCE_MS = 400

function asEstimate(v: unknown): AudienceEstimate | null {
  const o = v as { accounts?: unknown; afterSample?: unknown } | null
  if (!o || typeof o.accounts !== 'number') return null
  return { accounts: o.accounts, afterSample: typeof o.afterSample === 'number' ? o.afterSample : o.accounts }
}

/**
 * Estimation d'audience d'un modal, relancée quand le ciblage change.
 * `source` est le corps de la requête, ou null tant que le ciblage est incomplet (aucun appel).
 * Seul le dernier appel compte : une réponse lente d'un ancien ciblage n'écrase jamais la courante.
 * Une erreur du back (ou un back qui ne connaît pas encore la route) pose `error`, sans casser la page.
 */
export function useAudienceEstimate(source: Ref<AudienceEstimateRequest | null>, debounceMs = ESTIMATE_DEBOUNCE_MS) {
  const result = ref<AudienceEstimate | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let seq = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  async function run(body: AudienceEstimateRequest) {
    const mine = ++seq
    loading.value = true
    error.value = null
    try {
      const r = asEstimate(await videoModalService.estimateAudience(body))
      if (mine !== seq) return
      result.value = r
      if (!r) error.value = 'Réponse inattendue du serveur.'
    } catch (e) {
      if (mine !== seq) return
      result.value = null
      error.value = extractProblemMessage(e, 'Estimation indisponible pour le moment')
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  /** Relance tout de suite (bouton « Réessayer »). */
  function refresh() {
    clearTimer()
    if (source.value) void run(source.value)
  }

  watch(() => (source.value === null ? null : JSON.stringify(source.value)), () => {
    clearTimer()
    seq += 1
    result.value = null
    error.value = null
    const body = source.value
    if (body === null) {
      loading.value = false
      return
    }
    loading.value = true
    timer = setTimeout(() => { timer = null; void run(body) }, debounceMs)
  }, { immediate: true })

  if (getCurrentInstance()) onBeforeUnmount(() => { clearTimer(); seq += 1 })

  return { result, loading, error, refresh, ready: computed(() => source.value !== null) }
}
