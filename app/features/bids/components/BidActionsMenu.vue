<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { AdminBidDetail } from '@/features/bids/types/index'
import {
  BID_ACTION_FORBIDDEN, BID_ACTION_PERMISSION, BID_ACTION_UNAVAILABLE, cancelBlockedReason, disputeBlockedReason,
} from '@/features/bids/lib/bidActions'
import { bidLinks } from '@/features/bids/lib/bidLinks'
import { disputeStatusLabel } from '@/features/bids/lib/bidLabels'
import { useAuthStore } from '@/stores/auth'

/**
 * Menu « Actions » du tiroir : liens (paiement, litige, absence, conversation), copie des
 * identifiants et gestes super-admin. Conditions et garde-fous repris tels quels de l'ancienne
 * section Actions ; les modales et les messages de résultat restent dans la coquille.
 * Une entrée bloquée reste focalisable (`aria-disabled`) et annonce sa raison (`aria-describedby`).
 */
const props = defineProps<{
  bid: AdminBidDetail
  copied: string | null
  /** Tous les identifiants, une ligne chacun, pour « Copier les identifiants ». */
  identifiersText: string
  busy: boolean
  cancelUnavailable: boolean
  disputeUnavailable: boolean
}>()
const emit = defineEmits<{ copy: [key: string, value: string]; 'open-dialog': [kind: 'cancel' | 'dispute'] }>()
const auth = useAuthStore()

const routes = computed(() => bidLinks(props.bid, auth.can))
const disputeStatus = computed(() => props.bid.links?.disputeStatus ?? null)

const canAct = computed(() => auth.can(BID_ACTION_PERMISSION))
const cancelDisabledReason = computed(() => (!canAct.value ? BID_ACTION_FORBIDDEN : cancelBlockedReason(props.bid)))
const disputeDisabledReason = computed(() => (!canAct.value ? BID_ACTION_FORBIDDEN : disputeBlockedReason(props.bid)))
const cancelDisabled = computed(() => !!cancelDisabledReason.value || props.busy)
const disputeDisabled = computed(() => !!disputeDisabledReason.value || props.busy)

// ---- Ouverture, fermeture, clavier ----
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)

function items(): HTMLElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
}
async function show(at: 'first' | 'last' = 'first') {
  open.value = true
  await nextTick()
  const list = items()
  list[at === 'first' ? 0 : list.length - 1]?.focus()
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
  if (!open.value) {
    // Patron APG du bouton de menu : ↓ ouvre sur la première entrée, ↑ sur la dernière.
    if (e.target === trigger.value && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      void show(e.key === 'ArrowDown' ? 'first' : 'last')
    }
    return
  }
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
  if (kind === 'cancel' ? cancelDisabled.value : disputeDisabled.value) return
  hide()
  emit('open-dialog', kind)
}

/** Rend le focus au bouton « Actions » (fermeture d'une modale ouverte depuis le menu). */
defineExpose({ focus: () => trigger.value?.focus() })

const item = 'flex min-h-10 w-full items-center rounded-xs px-3 text-left text-sm transition-colors hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent'
const note = 'px-3 pb-1.5 text-xs text-text-muted text-pretty'
</script>

<template>
  <div ref="root" class="relative" data-test="section-actions" @keydown="onKeydown">
    <button
      ref="trigger" type="button" data-test="bid-actions-menu" aria-haspopup="menu" :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="open ? 'bid-actions-list' : undefined"
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
          v-if="routes.payment" :to="routes.payment"
          role="menuitem" data-test="action-payment" :class="item" @click="hide()"
        >Voir le paiement</NuxtLink>
        <NuxtLink
          v-if="routes.dispute" :to="routes.dispute"
          role="menuitem" data-test="action-dispute" :class="[item, 'text-danger']" @click="hide()"
        >Voir le litige{{ disputeStatus ? ` (${disputeStatusLabel(disputeStatus)})` : '' }}</NuxtLink>
        <NuxtLink
          v-if="routes.noShow" :to="routes.noShow"
          role="menuitem" data-test="action-noshow" :class="[item, 'text-warning']" @click="hide()"
        >Voir l’absence signalée</NuxtLink>
        <NuxtLink
          v-if="routes.conversation" :to="routes.conversation"
          role="menuitem" data-test="action-conversation" :class="item" @click="hide()"
        >Voir la conversation</NuxtLink>
        <button
          type="button" role="menuitem" data-test="action-copy-ids" :class="item"
          @click="emit('copy', 'all', identifiersText)"
        >{{ copied === 'all' ? 'Identifiants copiés' : 'Copier les identifiants' }}</button>

        <div role="separator" class="my-1.5 border-t border-border" />
        <div role="none" data-test="actions-unavailable">
          <p role="none" class="px-3 pb-1 text-xs font-medium text-text-muted">Gestes super-admin</p>
          <button
            v-if="!cancelUnavailable" type="button" role="menuitem" data-test="action-cancel"
            :aria-disabled="cancelDisabled ? 'true' : undefined"
            :aria-describedby="cancelDisabledReason ? 'bid-cancel-reason' : undefined"
            :class="[item, 'font-medium text-danger']" @click="act('cancel')"
          >Annuler le colis</button>
          <p v-if="cancelUnavailable" role="none" :class="note" data-test="unavailable-cancel">Annuler le colis : {{ BID_ACTION_UNAVAILABLE }}</p>
          <p v-else-if="cancelDisabledReason" id="bid-cancel-reason" role="none" :class="note" data-test="cancel-disabled-reason">Annuler le colis : {{ cancelDisabledReason }}</p>
          <button
            v-if="!disputeUnavailable" type="button" role="menuitem" data-test="action-open-dispute"
            :aria-disabled="disputeDisabled ? 'true' : undefined"
            :aria-describedby="disputeDisabledReason ? 'bid-dispute-reason' : undefined"
            :class="[item, 'font-medium text-danger']" @click="act('dispute')"
          >Ouvrir un litige</button>
          <p v-if="disputeUnavailable" role="none" :class="note" data-test="unavailable-dispute">Ouvrir un litige : {{ BID_ACTION_UNAVAILABLE }}</p>
          <p v-else-if="disputeDisabledReason" id="bid-dispute-reason" role="none" :class="note" data-test="dispute-disabled-reason">Ouvrir un litige : {{ disputeDisabledReason }}</p>
          <p v-if="!auth.can('SUPPORT_TICKET_MANAGE')" role="none" :class="note" data-test="unavailable-support">
            Écrire aux personnes : réservé aux admins qui gèrent le support.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
