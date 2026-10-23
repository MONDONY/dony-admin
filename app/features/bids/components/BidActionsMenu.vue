<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { AdminBidDetail } from '@/features/bids/types/index'
import {
  BID_ACTION_FORBIDDEN, BID_ACTION_PERMISSION, BID_ACTION_UNAVAILABLE, cancelBlockedReason, disputeBlockedReason,
} from '@/features/bids/lib/bidActions'
import { disputeStatusLabel } from '@/features/bids/lib/bidLabels'
import { useAuthStore } from '@/stores/auth'

/**
 * Menu « Actions » du tiroir : liens (paiement, litige, absence, conversation), copie des
 * identifiants et gestes super-admin. Conditions et garde-fous repris tels quels de l'ancienne
 * section Actions ; les modales restent dans la coquille (événement `open-dialog`).
 */
const props = defineProps<{
  bid: AdminBidDetail
  copied: string | null
  /** Tous les identifiants, une ligne chacun, pour « Copier les identifiants ». */
  identifiersText: string
  busy: boolean
  cancelUnavailable: boolean
  disputeUnavailable: boolean
  success: string | null
  error: string | null
  /** Une modale de geste est ouverte : son erreur s'affiche dedans, pas ici. */
  dialogOpen?: boolean
}>()
const emit = defineEmits<{ copy: [key: string, value: string]; 'open-dialog': [kind: 'cancel' | 'dispute'] }>()
const auth = useAuthStore()

const money = computed(() => props.bid.money ?? null)
const links = computed(() => props.bid.links ?? null)
const canSeePayments = computed(() => auth.can('PAYMENT_VIEW'))
const canSeeDispute = computed(() => !!links.value?.disputeId && auth.can('DISPUTE_VIEW'))
const canSeeNoShow = computed(() => props.bid.status === 'NO_SHOW' && !!links.value?.cancellationId && auth.can('DISPUTE_VIEW'))
const canSeeConversation = computed(() => !!links.value?.conversationId && auth.can('MODERATION_VIEW'))

const canAct = computed(() => auth.can(BID_ACTION_PERMISSION))
const cancelDisabledReason = computed(() => (!canAct.value ? BID_ACTION_FORBIDDEN : cancelBlockedReason(props.bid)))
const disputeDisabledReason = computed(() => (!canAct.value ? BID_ACTION_FORBIDDEN : disputeBlockedReason(props.bid)))

// ---- Ouverture, fermeture, clavier ----
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)

function items(): HTMLElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
}
async function show() {
  open.value = true
  await nextTick()
  items()[0]?.focus()
}
function hide(focusTrigger = false) {
  open.value = false
  if (focusTrigger) trigger.value?.focus()
}
function toggle() {
  if (open.value) hide()
  else void show()
}
function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') {
    // Échap ferme le menu seulement : `useEscapeClose` du tiroir ignore un événement déjà traité.
    e.preventDefault()
    e.stopPropagation()
    hide(true)
    return
  }
  if (e.key === 'Tab') { hide(); return }
  const list = items()
  if (!list.length) return
  const i = list.indexOf(document.activeElement as HTMLElement)
  const next = e.key === 'ArrowDown' ? (i + 1) % list.length
    : e.key === 'ArrowUp' ? (i <= 0 ? list.length - 1 : i - 1)
      : e.key === 'Home' ? 0
        : e.key === 'End' ? list.length - 1
          : -1
  if (next < 0) return
  e.preventDefault()
  list[next]?.focus()
}
function onPointerDown(e: PointerEvent | MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) hide()
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onPointerDown)
  else document.removeEventListener('pointerdown', onPointerDown)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
watch(() => props.bid.id, () => { open.value = false })

function act(kind: 'cancel' | 'dispute') {
  hide()
  emit('open-dialog', kind)
}

const item = 'flex min-h-10 w-full items-center rounded-xs px-3 text-left text-sm transition-colors hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'
</script>

<template>
  <div ref="root" class="relative" data-test="section-actions" @keydown="onKeydown">
    <button
      ref="trigger" type="button" data-test="bid-actions-menu" aria-haspopup="menu" :aria-expanded="open ? 'true' : 'false'"
      aria-controls="bid-actions-list"
      class="inline-flex min-h-10 items-center gap-1.5 rounded-btn bg-primary px-4 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
      @click="toggle"
    >
      Actions
      <svg aria-hidden="true" viewBox="0 0 16 16" :class="['size-4 motion-safe:transition-transform', open ? 'rotate-180' : '']" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute left-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-2 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.12)]"
    >
      <div id="bid-actions-list" ref="menu" role="menu" aria-label="Actions sur le colis" class="flex flex-col">
        <NuxtLink
          v-if="money && canSeePayments" :to="{ path: '/transactions', query: { open: money.paymentId } }"
          role="menuitem" data-test="action-payment" :class="item" @click="hide()"
        >Voir le paiement</NuxtLink>
        <NuxtLink
          v-if="canSeeDispute && links" :to="{ path: '/incidents', query: { open: links.disputeId as string } }"
          role="menuitem" data-test="action-dispute" :class="[item, 'text-danger']" @click="hide()"
        >Voir le litige{{ links.disputeStatus ? ` (${disputeStatusLabel(links.disputeStatus)})` : '' }}</NuxtLink>
        <NuxtLink
          v-if="canSeeNoShow && links" :to="{ path: '/incidents', query: { tab: 'noshows', open: links.cancellationId as string } }"
          role="menuitem" data-test="action-noshow" :class="[item, 'text-warning']" @click="hide()"
        >Voir l’absence signalée</NuxtLink>
        <NuxtLink
          v-if="canSeeConversation && links" :to="{ path: '/moderation', query: { open: links.conversationId as string } }"
          role="menuitem" data-test="action-conversation" :class="item" @click="hide()"
        >Voir la conversation</NuxtLink>
        <button
          type="button" role="menuitem" data-test="action-copy-ids" :class="item"
          @click="emit('copy', 'all', identifiersText)"
        >{{ copied === 'all' ? 'Identifiants copiés' : 'Copier les identifiants' }}</button>

        <div role="separator" class="my-1.5 border-t border-border" />
        <p class="px-3 pb-1 text-xs font-medium text-text-muted" aria-hidden="true">Gestes super-admin</p>
        <button
          v-if="!cancelUnavailable" type="button" role="menuitem" data-test="action-cancel"
          :disabled="!!cancelDisabledReason || busy" :title="cancelDisabledReason ?? undefined"
          :aria-describedby="cancelDisabledReason ? 'bid-cancel-reason' : undefined"
          :class="[item, 'font-medium text-danger']" @click="act('cancel')"
        >Annuler le colis</button>
        <button
          v-if="!disputeUnavailable" type="button" role="menuitem" data-test="action-open-dispute"
          :disabled="!!disputeDisabledReason || busy" :title="disputeDisabledReason ?? undefined"
          :aria-describedby="disputeDisabledReason ? 'bid-dispute-reason' : undefined"
          :class="[item, 'font-medium text-danger']" @click="act('dispute')"
        >Ouvrir un litige</button>
      </div>
      <ul class="mt-1 space-y-1 px-3 pb-1 text-xs text-text-muted text-pretty" data-test="actions-unavailable">
        <li v-if="cancelUnavailable" data-test="unavailable-cancel">Annuler le colis : {{ BID_ACTION_UNAVAILABLE }}</li>
        <li v-else-if="cancelDisabledReason" id="bid-cancel-reason" data-test="cancel-disabled-reason">Annuler le colis : {{ cancelDisabledReason }}</li>
        <li v-if="disputeUnavailable" data-test="unavailable-dispute">Ouvrir un litige : {{ BID_ACTION_UNAVAILABLE }}</li>
        <li v-else-if="disputeDisabledReason" id="bid-dispute-reason" data-test="dispute-disabled-reason">Ouvrir un litige : {{ disputeDisabledReason }}</li>
        <li v-if="!auth.can('SUPPORT_TICKET_MANAGE')" data-test="unavailable-support">
          Écrire aux personnes : réservé aux admins qui gèrent le support.
        </li>
      </ul>
    </div>

    <p v-if="success" role="status" data-test="action-success" class="mt-2 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-pretty">{{ success }}</p>
    <p v-if="error && !dialogOpen" role="alert" data-test="action-error" class="mt-2 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty">{{ error }}</p>
  </div>
</template>
