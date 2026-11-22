<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PAYOUT_OVERRIDE_REASON_MAX, PAYOUT_OVERRIDE_REASON_MIN, overrideReasonValid } from '@/features/payments/types/index'
import type { FeeGestureId } from '@/features/payments/lib/cancellationFee'

/**
 * Confirmation d'un geste sur les frais d'annulation : motif obligatoire (10 à 500 caractères,
 * le back le vérifie aussi), explication de l'effet, un seul envoi à la fois.
 */
const props = defineProps<{ open: boolean; action: FeeGestureId; busy?: boolean; error?: string | null }>()
const emit = defineEmits<{ confirm: [reason: string]; cancel: [] }>()

const COPY: Record<FeeGestureId, { title: string; effect: string; confirm: string; placeholder: string }> = {
  waive: {
    title: 'Renoncer à la retenue',
    effect: 'Le prochain remboursement de l’expéditeur sera intégral. Cette action ne rembourse pas toute seule : lancez ensuite le remboursement habituel.',
    confirm: 'Renoncer',
    placeholder: 'Pourquoi renoncer à la retenue',
  },
  'retry-payout': {
    title: 'Relancer le versement',
    effect: 'Les nouveaux essais automatiques reprennent et un essai est lancé tout de suite.',
    confirm: 'Relancer',
    placeholder: 'Pourquoi relancer le versement',
  },
}
const copy = computed(() => COPY[props.action])

const reason = ref('')
watch(() => props.open, (o) => { if (o) reason.value = '' }, { immediate: true })
const length = computed(() => reason.value.trim().length)
const hint = computed(() => {
  if (length.value > PAYOUT_OVERRIDE_REASON_MAX) return `Le motif ne peut pas dépasser ${PAYOUT_OVERRIDE_REASON_MAX} caractères.`
  if (length.value < PAYOUT_OVERRIDE_REASON_MIN) return `Au moins ${PAYOUT_OVERRIDE_REASON_MIN} caractères : il est journalisé avec votre identifiant.`
  return 'Journalisé avec votre identifiant.'
})
const canSubmit = computed(() => !props.busy && overrideReasonValid(reason.value))
function submit() {
  if (!canSubmit.value) return
  emit('confirm', reason.value.trim())
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      data-test="fee-dialog" role="dialog" aria-modal="true" aria-labelledby="fee-dialog-title"
      class="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
    >
      <h2 id="fee-dialog-title" class="mb-1 font-display text-lg font-semibold text-balance">{{ copy.title }}</h2>
      <p data-test="fee-dialog-effect" class="mb-4 text-sm text-text-muted text-pretty">{{ copy.effect }}</p>

      <label class="block text-xs text-text-muted" for="fee-dialog-reason">Motif (obligatoire)</label>
      <textarea
        id="fee-dialog-reason" v-model="reason" data-test="fee-reason" rows="3" :placeholder="copy.placeholder"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text"
      />
      <div class="mb-4 flex items-start justify-between gap-3 text-xs">
        <span data-test="fee-reason-hint" class="text-text-muted text-pretty">{{ hint }}</span>
        <span
          data-test="fee-reason-count" class="shrink-0 tabular-nums"
          :class="length > PAYOUT_OVERRIDE_REASON_MAX ? 'text-danger' : 'text-text-muted'"
        >{{ length }} / {{ PAYOUT_OVERRIDE_REASON_MAX }}</span>
      </div>

      <p
        v-if="error" data-test="fee-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="fee-cancel"
          class="rounded-btn border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-elevated"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="button" data-test="fee-submit" :disabled="!canSubmit"
          class="whitespace-nowrap rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="submit"
        >{{ busy ? 'En cours…' : copy.confirm }}</button>
      </div>
    </div>
  </div>
</template>
