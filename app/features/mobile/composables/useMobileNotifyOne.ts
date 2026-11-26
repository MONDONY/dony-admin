import { computed, onScopeDispose, ref } from 'vue'
import { mobileNotifyService } from '@/features/mobile/services/mobileNotifyService'
import { canSendNotification, notifyErrorMessage, NOTIFY_BODY_MAX, NOTIFY_TITLE_MAX } from '@/features/mobile/lib/mobileNotify'
import { isUuid, userDisplayName, useUserSearch } from '@/features/broadcast/composables/useUserSearch'
import { useAuthStore } from '@/stores/auth'
import type { AdminUserListItem } from '@/features/users/types/index'

export type NotifyStep = 'edit' | 'confirm' | 'sent'

const SEARCH_DELAY_MS = 300

/**
 * Notifier UNE personne : choix du destinataire (recherche, droit USER_VIEW), titre, message, confirmation, envoi.
 * Rien n'est écrit en stockage ni en journal ; l'envoi n'a lieu qu'au tap sur « Confirmer l'envoi ».
 */
export function useMobileNotifyOne() {
  const auth = useAuthStore()
  const canSearch = computed(() => auth.can('USER_VIEW'))
  const picker = useUserSearch()

  const step = ref<NotifyStep>('edit')
  const recipient = ref<{ id: string; name: string } | null>(null)
  const term = ref('')
  const pickError = ref<string | null>(null)
  const title = ref('')
  const body = ref('')
  const busy = ref(false)
  const error = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancelTimer = () => { if (timer) { clearTimeout(timer); timer = null } }
  onScopeDispose(cancelTimer)

  const canReview = computed(() => canSearch.value && recipient.value !== null && canSendNotification({
    userId: recipient.value.id, title: title.value, body: body.value,
  }))

  function setTerm(value: string) {
    term.value = value
    pickError.value = null
    cancelTimer()
    if (!canSearch.value) return
    const v = value.trim()
    if (isUuid(v)) { picker.clear(); void pickById(v); return }
    timer = setTimeout(() => { void picker.search(value) }, SEARCH_DELAY_MS)
  }

  /** Identifiant collé : on retrouve le nom pour que l'admin voie QUI il va notifier. */
  async function pickById(id: string) {
    const name = await picker.resolveName(id)
    if (term.value.trim() !== id) return
    if (!name) { pickError.value = 'Utilisateur introuvable : vérifiez l’identifiant.'; return }
    recipient.value = { id, name }
    term.value = ''
  }

  function choose(u: AdminUserListItem) {
    cancelTimer()
    picker.clear()
    recipient.value = { id: u.id, name: userDisplayName(u) }
    term.value = ''
    pickError.value = null
  }

  function changeRecipient() {
    recipient.value = null
    term.value = ''
    picker.clear()
  }

  function review() {
    if (!canReview.value || busy.value) return
    error.value = null
    step.value = 'confirm'
  }

  function backToEdit() {
    if (busy.value) return
    step.value = 'edit'
  }

  async function confirm() {
    if (busy.value || step.value !== 'confirm' || !canReview.value || !recipient.value) return
    busy.value = true
    error.value = null
    try {
      await mobileNotifyService.sendToOne({ userId: recipient.value.id, title: title.value.trim(), body: body.value.trim() })
      step.value = 'sent'
    } catch (e) {
      error.value = notifyErrorMessage(e)
      step.value = 'edit'
    } finally {
      busy.value = false
    }
  }

  function reset() {
    cancelTimer()
    picker.clear()
    recipient.value = null
    term.value = ''
    pickError.value = null
    title.value = ''
    body.value = ''
    error.value = null
    step.value = 'edit'
  }

  return {
    canSearch, step, recipient, term, title, body, busy, error, pickError, canReview,
    results: picker.results, searching: picker.searching, searched: picker.searched, searchError: picker.error,
    titleMax: NOTIFY_TITLE_MAX, bodyMax: NOTIFY_BODY_MAX,
    setTerm, choose, changeRecipient, review, backToEdit, confirm, reset,
  }
}
