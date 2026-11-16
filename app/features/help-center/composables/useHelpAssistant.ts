import { computed, ref } from 'vue'
import { helpCenterService } from '@/features/help-center/services/helpCenterService'
import type { HelpRoute, HelpSource, HelpTurn } from '@/features/help-center/types'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

export const QUESTION_MAX_LENGTH = 500
/** Tours envoyés au back : il n'en garde pas davantage. */
export const HISTORY_SENT = 8

export interface AssistantMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  answered?: boolean
  actions?: HelpRoute[]
  sources?: HelpSource[]
  /** Réponse impossible (quota, assistant éteint, erreur) : affichée autrement, jamais renvoyée au modèle. */
  failed?: boolean
  /** Question à laquelle répond ce message : sert au lien « Chercher dans la doc ». */
  question?: string
}

export const ASSISTANT_DISABLED = 'L’assistant est désactivé pour le moment. La documentation reste disponible : cherchez votre sujet dans le centre d’aide.'
export const ASSISTANT_UNAVAILABLE = 'L’assistant n’est pas encore disponible sur ce serveur. Cherchez votre sujet dans le centre d’aide.'

// Conversation gardée le temps de la session : elle survit aux changements de page, jamais au rechargement.
const messages = ref<AssistantMessage[]>([])
const pending = ref(false)
const open = ref(false)
const remaining = ref<number | null>(null)
let nextId = 1

function failure(e: unknown): string {
  if (isEndpointMissing(e)) return ASSISTANT_UNAVAILABLE
  if (problemCode(e) === 'admin-help-assistant-disabled') return ASSISTANT_DISABLED
  return extractProblemMessage(e, 'L’assistant n’a pas pu répondre. Réessayez dans un instant.')
}

export function useHelpAssistant() {
  const history = computed<HelpTurn[]>(() => messages.value
    .filter(m => !m.failed)
    .map(m => ({ role: m.role, text: m.text }))
    .slice(-HISTORY_SENT))

  async function send(raw: string): Promise<boolean> {
    const question = raw.trim().slice(0, QUESTION_MAX_LENGTH)
    if (!question || pending.value) return false
    const previous = history.value
    messages.value.push({ id: nextId++, role: 'user', text: question })
    pending.value = true
    try {
      const r = await helpCenterService.ask(question, previous)
      remaining.value = r.remaining
      messages.value.push({
        id: nextId++, role: 'assistant', text: r.answer, answered: r.answered,
        actions: r.actions ?? [], sources: r.sources ?? [], question,
      })
    } catch (e) {
      messages.value.push({ id: nextId++, role: 'assistant', text: failure(e), failed: true, question })
    } finally {
      pending.value = false
    }
    return true
  }

  function reset() {
    if (pending.value) return
    messages.value = []
    remaining.value = null
  }

  function toggle(value = !open.value) { open.value = value }

  return { messages, pending, open, remaining, history, send, reset, toggle }
}

export function _resetHelpAssistant(): void {
  messages.value = []
  pending.value = false
  open.value = false
  remaining.value = null
  nextId = 1
}
