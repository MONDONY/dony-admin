import { computed, onScopeDispose, ref } from 'vue'
import { mobileNotifyService } from '@/features/mobile/services/mobileNotifyService'
import { mobileUsersService } from '@/features/mobile/services/mobileUsersService'
import { useMobileUserSearch } from '@/features/mobile/composables/useMobileUserSearch'
import {
  accountInfo, canSendNotification, identityLine, isAmbiguousFailure, notifyErrorMessage, recipientName,
  NOTIFY_BODY_MAX, NOTIFY_NO_RECIPIENT, NOTIFY_RETRY_LOCK_MS, NOTIFY_TITLE_MAX, NOTIFY_UNREACHABLE,
} from '@/features/mobile/lib/mobileNotify'
import { isUuid } from '@/lib/safeInput'
import { useAuthStore } from '@/stores/auth'
import type { AdminUserListItem } from '@/features/users/types/index'

export type NotifyStep = 'edit' | 'confirm' | 'sent' | 'uncertain'
export interface NotifyRecipient { id: string; name: string; email: string | null }
/** `loading` : fiche en cours de lecture ; `ok` : joignable ; `blocked` : banni ou suppression demandée ; `unknown` : fiche illisible. */
export interface NotifyAccount { state: 'loading' | 'ok' | 'blocked' | 'unknown'; label: string }

const SEARCH_DELAY_MS = 300

/**
 * Notifier UNE personne : choix du destinataire (recherche, droit USER_VIEW), contrôle du compte (lecture seule),
 * titre, message, confirmation, envoi. Rien n'est écrit en stockage ni en journal ; l'envoi n'a lieu qu'au tap
 * sur « Confirmer l'envoi ». Un échec incertain (réseau, 5xx, 408, 429) ouvre une étape dédiée, jamais un renvoi direct.
 */
export function useMobileNotifyOne() {
  const auth = useAuthStore()
  const canSearch = computed(() => auth.can('USER_VIEW'))
  const picker = useMobileUserSearch()

  const step = ref<NotifyStep>('edit')
  const recipient = ref<NotifyRecipient | null>(null)
  const account = ref<NotifyAccount>({ state: 'loading', label: 'Vérification du compte…' })
  const term = ref('')
  const pickError = ref<string | null>(null)
  const title = ref('')
  const body = ref('')
  const busy = ref(false)
  const error = ref<string | null>(null)
  const sentTo = ref<string | null>(null)
  const now = ref(Date.now())
  let lockUntil = 0
  let lockKey = ''
  let tick: ReturnType<typeof setInterval> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let pickSeq = 0
  const cancelTimer = () => { if (timer) { clearTimeout(timer); timer = null } }
  const stopTick = () => { if (tick) { clearInterval(tick); tick = null } }
  onScopeDispose(() => { cancelTimer(); stopTick() })

  const canReview = computed(() => canSearch.value && recipient.value !== null && canSendNotification({
    userId: recipient.value.id, title: title.value, body: body.value,
  }))
  const identity = computed(() => (recipient.value ? identityLine(recipient.value.id, recipient.value.email) : ''))
  const unreachableReason = computed(() => (account.value.state === 'blocked' ? NOTIFY_UNREACHABLE : null))
  const canConfirm = computed(() => canReview.value && account.value.state === 'ok' && !busy.value)
  const lockSeconds = computed(() => Math.max(0, Math.ceil((lockUntil - now.value) / 1000)))
  const payloadKey = () => `${recipient.value?.id}|${title.value.trim()}|${body.value.trim()}`

  /** Lecture seule de la fiche : statut du compte (et e-mail masqué). Les réponses périmées sont ignorées. */
  async function loadAccount(id: string, seq: number = pickSeq) {
    account.value = { state: 'loading', label: 'Vérification du compte…' }
    try {
      const u = await mobileUsersService.get(id)
      if (seq !== pickSeq || recipient.value?.id !== id) return
      const info = accountInfo(u.status)
      account.value = { state: info.blocked ? (u.status ? 'blocked' : 'unknown') : 'ok', label: info.label }
      if (u.email && recipient.value) recipient.value = { ...recipient.value, email: u.email }
    } catch {
      if (seq !== pickSeq || recipient.value?.id !== id) return
      account.value = { state: 'unknown', label: accountInfo(null).label }
    }
  }

  function retryAccount() {
    if (recipient.value) void loadAccount(recipient.value.id, pickSeq)
  }

  function setTerm(value: string) {
    term.value = value
    pickError.value = null
    cancelTimer()
    if (!canSearch.value) return
    const v = value.trim()
    if (isUuid(v)) { picker.clear(); void pickById(v); return }
    timer = setTimeout(() => { void picker.search(value) }, SEARCH_DELAY_MS)
  }

  /** Identifiant collé : on lit la fiche pour que l'admin voie QUI il va notifier, et son statut. */
  async function pickById(id: string) {
    const seq = ++pickSeq
    try {
      const u = await mobileUsersService.get(id)
      if (seq !== pickSeq || term.value.trim() !== id) return
      const info = accountInfo(u.status)
      recipient.value = { id, name: recipientName(u), email: u.email ?? null }
      account.value = { state: info.blocked ? 'blocked' : 'ok', label: info.label }
      term.value = ''
    } catch {
      if (seq !== pickSeq || term.value.trim() !== id) return
      pickError.value = 'Utilisateur introuvable : vérifiez l’identifiant.'
    }
  }

  function choose(u: AdminUserListItem) {
    cancelTimer()
    picker.clear()
    const seq = ++pickSeq
    recipient.value = { id: u.id, name: recipientName(u), email: u.email ?? null }
    term.value = ''
    pickError.value = null
    void loadAccount(u.id, seq)
  }

  function changeRecipient() {
    cancelTimer()
    pickSeq++
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

  function startLock() {
    lockKey = payloadKey()
    now.value = Date.now()
    lockUntil = now.value + NOTIFY_RETRY_LOCK_MS
    stopTick()
    tick = setInterval(() => {
      now.value = Date.now()
      if (now.value >= lockUntil) stopTick()
    }, 1000)
  }

  async function confirm() {
    if (busy.value || step.value !== 'confirm' || !canConfirm.value || !recipient.value) return
    // Même envoi qu'un échec incertain : verrouillé 10 s.
    if (lockKey === payloadKey() && Date.now() < lockUntil) return
    busy.value = true
    error.value = null
    const to = recipient.value
    try {
      const res = await mobileNotifyService.sendToOne({ userId: to.id, title: title.value.trim(), body: body.value.trim() })
      if (typeof res?.recipientCount === 'number' && res.recipientCount < 1) {
        error.value = NOTIFY_NO_RECIPIENT
        step.value = 'edit'
        return
      }
      sentTo.value = `${to.name} ${identityLine(to.id)}`
      step.value = 'sent'
    } catch (e) {
      error.value = notifyErrorMessage(e)
      if (isAmbiguousFailure(e)) { startLock(); step.value = 'uncertain' } else step.value = 'edit'
    } finally {
      busy.value = false
    }
  }

  /** Après un échec incertain : retour à la confirmation (second tap obligatoire), seulement une fois le verrou levé. */
  function resendAnyway() {
    if (lockSeconds.value > 0 || busy.value) return
    error.value = null
    step.value = 'confirm'
  }

  function backToForm() {
    error.value = null
    step.value = 'edit'
  }

  function reset() {
    cancelTimer()
    stopTick()
    pickSeq++
    picker.clear()
    recipient.value = null
    term.value = ''
    pickError.value = null
    title.value = ''
    body.value = ''
    error.value = null
    sentTo.value = null
    lockUntil = 0
    lockKey = ''
    step.value = 'edit'
  }

  return {
    canSearch, step, recipient, account, identity, term, title, body, busy, error, pickError, sentTo,
    canReview, canConfirm, unreachableReason, lockSeconds,
    results: picker.results, searching: picker.searching, searched: picker.searched, searchError: picker.error,
    titleMax: NOTIFY_TITLE_MAX, bodyMax: NOTIFY_BODY_MAX,
    setTerm, choose, changeRecipient, retryAccount, review, backToEdit, confirm, resendAnyway, backToForm, reset,
  }
}
