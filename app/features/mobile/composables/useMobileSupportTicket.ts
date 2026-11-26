import { computed, ref, type Ref } from 'vue'
import { supportService } from '@/features/support/services/supportService'
import { checkReply } from '@/features/mobile/lib/mobileSupport'
import type { AdminSupportTicket, SupportMessage } from '@/features/support/types/index'
import { useAuthStore } from '@/stores/auth'
import { extractProblemMessage } from '@/lib/problemDetail'
import { httpStatus } from '@/lib/violations'
import { uuidParam } from '@/lib/safeInput'

export const NOT_ASSIGNED_MESSAGE = 'Ce billet n’est pas assigné à vous : prenez-le en charge depuis l’ordinateur'
export const TAKEN_BY_COLLEAGUE_MESSAGE = 'Ce billet vient d’être pris en charge par un collègue'

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
  const assigning = ref(false)
  const assignError = ref<string | null>(null)
  /** Route de prise en charge refusée ou absente : le bouton disparaît. */
  const assignAvailable = ref(true)
  let seq = 0
  let tmp = 0

  const id = computed(() => uuidParam(rawId.value))
  const isResolved = computed(() => ticket.value?.status === 'RESOLVED')
  const isMine = computed(() => !!ticket.value?.assignedAdminId && ticket.value.assignedAdminId === auth.user?.id)
  const isUnassigned = computed(() => !!ticket.value && !ticket.value.assignedAdminId)
  const canManage = computed(() => auth.can('SUPPORT_TICKET_MANAGE'))
  /** Le back refuse la réponse d'un admin qui n'est pas l'assigné : le champ n'apparaît que pour le sien. */
  const canReply = computed(() => !!ticket.value && !isResolved.value && canManage.value && isMine.value)
  const canAssign = computed(() => !!ticket.value && !isResolved.value && canManage.value && isUnassigned.value && assignAvailable.value)
  const heldByColleague = computed(() => !!ticket.value && !isResolved.value && !!ticket.value.assignedAdminId && !isMine.value)
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

  /** Seule action d'assignation du mobile : se saisir d'un billet que personne n'a pris. */
  async function assign() {
    const current = id.value
    if (!current || !canAssign.value || assigning.value) return
    assigning.value = true
    assignError.value = null
    try {
      await supportService.assign(current)
      await load()
    } catch (e) {
      const status = httpStatus(e)
      if (status === 409) {
        await load()
        assignError.value = TAKEN_BY_COLLEAGUE_MESSAGE
      } else {
        assignError.value = extractProblemMessage(e, 'Prise en charge impossible pour le moment')
        if (status === 403 || status === 404 || status === 405) assignAvailable.value = false
      }
    } finally {
      assigning.value = false
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

  return { ticket, messages, isLoading, error, notFound, draft, sending, sendError, isResolved, canReply, canSend, canAssign, heldByColleague, assigning, assignError, load, send, assign }
}
