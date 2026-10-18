<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { currencyDecimals } from '@/features/incidents/types/index'
import type { AdminWalletRefundRequest, ResolveWalletRefundBody } from '@/features/finance/types/index'
import { checkPaidAmount, initialPaidAmount, RESOLUTION_NOTE_MAX } from '@/features/finance/components/walletRefundPaidAmount'

/**
 * Clôture d'un ticket manuel de remboursement wallet, une fois l'argent versé hors plateforme.
 * Le montant réellement versé (prérempli avec le montant demandé) peut être inférieur : l'écart
 * est le frais d'opérateur à la charge de l'utilisateur. Le solde, lui, est débité en entier.
 */
const props = defineProps<{
  open: boolean
  request: AdminWalletRefundRequest | null
  busy?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ confirm: [body: ResolveWalletRefundBody]; cancel: [] }>()

const paidAmount = ref('')
const note = ref('')
watch(() => [props.open, props.request?.id] as const, ([o]) => {
  if (o && props.request) {
    paidAmount.value = initialPaidAmount(props.request.amount, props.request.currency)
    note.value = ''
  }
}, { immediate: true })

const fieldId = useId()
const check = computed(() => props.request
  ? checkPaidAmount(paidAmount.value, props.request.amount, props.request.currency)
  : null)
const noteLength = computed(() => note.value.trim().length)
const canConfirm = computed(() => !props.busy && check.value?.ok === true && noteLength.value <= RESOLUTION_NOTE_MAX)

function fmt(amount: number, currency: string) {
  const d = currencyDecimals(currency)
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' ' + currency
}
const gap = computed(() => {
  const c = check.value
  if (!props.request || !c?.ok) return null
  const diff = props.request.amount - c.value
  return diff > 0 ? fmt(diff, props.request.currency) : null
})

function onConfirm() {
  const c = check.value
  if (!canConfirm.value || !c?.ok) return
  const trimmed = note.value.trim()
  emit('confirm', { paidAmount: c.value, note: trimmed.length ? trimmed : null })
}
</script>

<template>
  <div v-if="open && request" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      data-test="wrr-resolve-dialog" role="dialog" aria-modal="true" :aria-labelledby="`${fieldId}-title`"
      class="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
    >
      <h2 :id="`${fieldId}-title`" class="font-display text-lg font-semibold mb-1 text-balance">Marquer la demande remboursée</h2>
      <p class="text-sm text-text-muted mb-3 text-pretty">
        {{ request.userName || 'Utilisateur' }} a demandé
        <span class="font-medium text-text tabular-nums" data-test="wrr-dialog-requested">{{ fmt(request.amount, request.currency) }}</span>.
        Indiquez ce qui a réellement été versé hors plateforme.
      </p>
      <p class="mb-4 rounded-btn border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-text text-pretty">
        Le solde de l’utilisateur est débité en entier, quel que soit le montant saisi.
      </p>

      <label class="block text-xs text-text-muted" :for="`${fieldId}-amount`">Montant réellement versé</label>
      <div class="mt-1 flex items-center gap-2">
        <input
          :id="`${fieldId}-amount`" v-model="paidAmount" data-test="wrr-paid-amount" type="text" inputmode="decimal"
          autocomplete="off" :disabled="busy" :aria-invalid="check?.ok === false"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm text-text tabular-nums disabled:opacity-60"
        >
        <span class="shrink-0 text-sm text-text-muted">{{ request.currency }}</span>
      </div>
      <p v-if="check && !check.ok" data-test="wrr-paid-amount-error" class="mt-1 text-xs text-danger text-pretty">{{ check.error }}</p>
      <p v-else-if="gap" data-test="wrr-paid-amount-gap" class="mt-1 text-xs text-text-muted text-pretty">
        Écart de <span class="tabular-nums">{{ gap }}</span> : frais d’opérateur à la charge de l’utilisateur.
      </p>

      <label class="mt-4 block text-xs text-text-muted" :for="`${fieldId}-note`">Note (facultative)</label>
      <textarea
        :id="`${fieldId}-note`" v-model="note" data-test="wrr-note" rows="3" :disabled="busy"
        placeholder="Moyen de versement, référence, raison de l’écart…"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-60"
      />
      <div class="mb-4 flex justify-end text-xs">
        <span
          data-test="wrr-note-count" class="tabular-nums"
          :class="noteLength > RESOLUTION_NOTE_MAX ? 'text-danger' : 'text-text-muted'"
        >{{ noteLength }} / {{ RESOLUTION_NOTE_MAX }}</span>
      </div>

      <p
        v-if="error" data-test="wrr-resolve-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="wrr-resolve-cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border transition-colors hover:bg-surface-elevated"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="button" data-test="wrr-resolve-confirm" :disabled="!canConfirm"
          class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="onConfirm"
        >{{ busy ? 'En cours…' : 'Marquer remboursée' }}</button>
      </div>
    </div>
  </div>
</template>
