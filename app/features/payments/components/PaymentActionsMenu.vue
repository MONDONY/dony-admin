<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { PaymentAction, PaymentActionId } from '@/features/payments/lib/paymentActions'

/**
 * Menu « Actions » du tiroir paiement : les gestes de l'ancien panneau (`paymentActions`), mêmes
 * `data-test`. Un geste impossible reste focalisable (`aria-disabled`) et annonce sa raison
 * (`aria-describedby`) ; pendant un envoi, tous sont désactivés. Les dialogues restent dans la
 * coquille. Même patron clavier que le menu du tiroir colis (APG « menu button »).
 */
const props = defineProps<{ actions: PaymentAction[]; busy?: boolean }>()
const emit = defineEmits<{ act: [id: PaymentActionId] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)

function items(): HTMLElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
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

function act(a: PaymentAction) {
  if (!a.enabled || props.busy) return
  hide()
  emit('act', a.id)
}

/** Rend le focus au bouton « Actions » (fermeture d'une modale ouverte depuis le menu). */
defineExpose({ focus: () => trigger.value?.focus() })

const TONE: Record<PaymentAction['tone'], string> = { success: 'text-success', warning: 'text-warning', primary: 'text-primary' }
const item = 'flex min-h-10 w-full items-center rounded-xs px-3 text-left text-sm font-medium transition-colors hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none disabled:cursor-wait disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent'
</script>

<template>
  <div ref="root" class="relative" data-test="payment-actions" @keydown="onKeydown">
    <button
      ref="trigger" type="button" data-test="payment-actions-menu" aria-haspopup="menu" :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="open ? 'payment-actions-list' : undefined"
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
      <div id="payment-actions-list" ref="menu" role="menu" aria-label="Actions sur le paiement" class="flex flex-col">
        <template v-for="a in actions" :key="a.id">
          <button
            type="button" role="menuitem" :data-test="`action-${a.id}`" :disabled="busy"
            :aria-disabled="a.enabled ? undefined : 'true'"
            :aria-describedby="a.reason ? `payment-${a.id}-reason` : undefined"
            :class="[item, TONE[a.tone]]" @click="act(a)"
          >{{ busy ? 'En cours…' : a.label }}</button>
          <p
            v-if="a.reason" :id="`payment-${a.id}-reason`" role="none" :data-test="`${a.id}-disabled-reason`"
            class="px-3 pb-1.5 text-xs text-text-muted text-pretty"
          >{{ a.reason }}</p>
        </template>
      </div>
    </div>
  </div>
</template>
