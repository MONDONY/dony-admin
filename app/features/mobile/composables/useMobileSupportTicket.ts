import { computed, ref, type Ref } from 'vue'
import { supportService } from '@/features/support/services/supportService'
import { checkReply } from '@/features/mobile/lib/mobileSupport'
import type { AdminSupportTicket, SupportMessage } from '@/features/support/types/index'
import { useAuthStore } from '@/stores/auth'
import { extractProblemMessage } from '@/lib/problemDetail'
import { httpStatus } from '@/lib/violations'
import { uuidParam } from '@/lib/safeInput'

export const NOT_ASSIGNED_MESSAGE = 'Ce billet n’est pas assigné à vous : prenez-le en charge depuis l’ordinateur'

/**
 * Conversation de support sur mobile : lire et répondre, rien d'autre (ni résolution, ni
 * assignation, ni pièce jointe). La réponse apparaît tout de suite et se retire si l'envoi échoue.
 */
export function useMobileSupportTicket(rawId: Ref<unknown>) {
  const auth = useAuthStore()
  const ticket = ref<AdminSupportTicket | null>(null)
  const messages = ref<SupportMessage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)
  const draft = ref('')
  const sending = ref(false)
  const sendError = ref<string | null>(null)
  let seq = 0
  let tmp = 0

  const id = computed(() => uuidParam(rawId.value))
  const isResolved = computed(() => ticket.value?.status === 'RESOLVED')
  const canReply = computed(() => !!ticket.value && !isResolved.value && auth.can('SUPPORT_TICKET_MANAGE'))
  const canSend = computed(() => canReply.value && !sending.value && checkReply(draft.value).ok)

  async function load() {
    const current = id.value
    const my = ++seq
    error.value = null
    notFound.value = false
    if (!current) {
      ticket.value = null
      messages.value = []
      notFound.value = true
      return
    }
    isLoading.value = true
    try {
      const result = await supportService.get(current)
      if (my !== seq) return
      ticket.value = result
      messages.value = result.messages ?? []
    } catch (e) {
      if (my !== seq) return
      ticket.value = null
      messages.value = []
      if (httpStatus(e) === 404) notFound.value = true
      else error.value = extractProblemMessage(e, 'Impossible de charger la conversation')
    } finally {
      if (my === seq) isLoading.value = false
    }
  }

  async function send() {
    const current = id.value
    if (!current || !canReply.value || sending.value) return
    const checked = checkReply(draft.value)
    if (!checked.ok) {
      sendError.value = checked.error
      return
    }
    sending.value = true
    sendError.value = null
    const sentDraft = draft.value
    const pending: SupportMessage = {
      id: `pending-${++tmp}`, authorType: 'ADMIN', content: checked.text, createdAt: new Date().toISOString(),
    }
    messages.value = [...messages.value, pending]
    draft.value = ''
    try {
      const created = await supportService.reply(current, checked.text)
      messages.value = messages.value.map(m => (m.id === pending.id ? created : m))
    } catch (e) {
      messages.value = messages.value.filter(m => m.id !== pending.id)
      draft.value = sentDraft
      sendError.value = httpStatus(e) === 409 ? NOT_ASSIGNED_MESSAGE : extractProblemMessage(e, 'Envoi impossible pour le moment')
    } finally {
      sending.value = false
    }
  }

  return { ticket, messages, isLoading, error, notFound, draft, sending, sendError, isResolved, canReply, canSend, load, send }
}
