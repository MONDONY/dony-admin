import { ref } from 'vue'
import { broadcastService } from '@/features/broadcast/services/broadcastService'
import { parseRule } from '@/features/broadcast/composables/audienceRule'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { BroadcastSegment, RuleGroup } from '@/features/broadcast/types/index'

// Une seule page suffit pour un outil d'équipe ; le back plafonne de toute façon la taille.
const LIST_SIZE = 100

function segmentError(e: unknown, fallback: string): string {
  const err = e as { statusCode?: number; status?: number } | undefined
  if ((err?.statusCode ?? err?.status) === 409) return 'Ce nom est déjà pris'
  return extractProblemMessage(e, fallback)
}

/**
 * Segments enregistrés. Les écritures renvoient `null` en cas de succès, sinon le message à
 * afficher à côté du formulaire concerné (et non dans la bannière globale).
 */
export function useBroadcastSegments() {
  const segments = ref<BroadcastSegment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSegments() {
    loading.value = true
    error.value = null
    try {
      segments.value = (await broadcastService.segments.list(0, LIST_SIZE)).content
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les segments')
    } finally {
      loading.value = false
    }
  }

  async function write(action: () => Promise<unknown>, fallback: string): Promise<string | null> {
    try {
      await action()
    } catch (e) {
      return segmentError(e, fallback)
    }
    await fetchSegments()
    return null
  }

  const create = (name: string, description: string | null, rule: RuleGroup) =>
    write(() => broadcastService.segments.create(name, description, rule), 'Enregistrement impossible')

  const update = (id: string, name: string, description: string | null, rule: RuleGroup) =>
    write(() => broadcastService.segments.update(id, name, description, rule), 'Modification impossible')

  /** Renommer garde la règle et la description telles que le back les a stockées. */
  const rename = (segment: BroadcastSegment, name: string) =>
    update(segment.id, name, segment.description, parseRule(segment.rule))

  const remove = (id: string) =>
    write(() => broadcastService.segments.remove(id), 'Suppression impossible')

  return { segments, loading, error, fetchSegments, create, update, rename, remove }
}
