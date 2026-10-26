import { computed, ref } from 'vue'
import { supportService } from '@/features/support/services/supportService'
import type { SupportReplyTemplate } from '@/features/support/types/index'
import { QUICK_REPLIES, type QuickReply } from '@/features/support/lib/supportWorkbench'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'

/**
 * Réponses types des agents. Servies par le back (#660) ; sur un ancien back, la liste fixe de l'app
 * reste proposée et leur gestion n'est pas offerte. Gérer = ajouter, modifier, supprimer.
 */
export function useReplyTemplates() {
  const templates = ref<SupportReplyTemplate[]>([])
  /** Le serveur ne connaît pas encore les réponses types : repli sur la liste fixe, sans gestion. */
  const unavailable = ref(false)
  /** Les réponses du serveur ont été lues : jusque-là, ou si la lecture échoue, la liste fixe reste proposée. */
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)

  /** Ce que le poste propose : celles du serveur (même vides, si l'équipe les a toutes retirées), sinon la liste fixe. */
  const options = computed<QuickReply[]>(() => (!loaded.value
    ? QUICK_REPLIES
    : templates.value.map((t) => ({ label: t.label, text: t.content }))))

  async function load() {
    try {
      const list = await supportService.listTemplates()
      if (!Array.isArray(list)) { unavailable.value = true; return }
      templates.value = list
      unavailable.value = false
      loaded.value = true
    } catch (e) {
      if (isEndpointMissing(e)) unavailable.value = true
      else error.value = extractProblemMessage(e, 'Réponses types indisponibles')
    }
  }

  /** Un geste de gestion ; la liste est relue ensuite, le serveur fait foi. Renvoie vrai si le geste a abouti. */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      await action()
      // Toujours un nouveau tableau : la fenêtre se referme sur ce changement, même si la liste relue est identique.
      templates.value = [...(await supportService.listTemplates())]
      return true
    } catch (e) {
      error.value = extractProblemMessage(e, 'Action impossible')
      return false
    } finally {
      busy.value = false
    }
  }
  const create = (label: string, content: string) => run(() => supportService.createTemplate(label, content))
  const update = (id: string, label: string, content: string) => run(() => supportService.updateTemplate(id, label, content))
  const remove = (id: string) => run(() => supportService.deleteTemplate(id))

  return { templates, options, unavailable, loaded, error, busy, load, create, update, remove }
}
