<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { RESTORE_REASON_MAX, RESTORE_REASON_MIN, restoreReasonValid } from '@/lib/restoreReason'

/**
 * Geste réparateur motivé : restaurer un élément supprimé ou annuler une suppression de
 * compte. Le motif (10 à 500 caractères) est journalisé, d'où le compteur visible : le back
 * refuserait sinon en 422 un motif trop court, après coup.
 */
const props = defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel: string
  /** Conséquence à rappeler avant de confirmer (note recalculée, utilisateur prévenu…). */
  notice?: string | null
  busy?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ confirm: [reason: string]; cancel: [] }>()

const reason = ref('')
watch(() => props.open, (o) => { if (o) reason.value = '' }, { immediate: true })

const fieldId = useId()
const reasonLength = computed(() => reason.value.trim().length)
const reasonHint = computed(() => {
  if (reasonLength.value > RESTORE_REASON_MAX) return `Le motif ne peut pas dépasser ${RESTORE_REASON_MAX} caractères.`
  if (reasonLength.value < RESTORE_REASON_MIN) return `Au moins ${RESTORE_REASON_MIN} caractères : il est journalisé avec votre identifiant.`
  return 'Journalisé avec votre identifiant.'
})
const canConfirm = computed(() => !props.busy && restoreReasonValid(reason.value))

function onConfirm() {
  if (canConfirm.value) emit('confirm', reason.value.trim())
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      data-test="restore-dialog" role="dialog" aria-modal="true" :aria-labelledby="`${fieldId}-title`"
      class="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
    >
      <h2 :id="`${fieldId}-title`" class="font-display text-lg font-semibold mb-1 text-balance">{{ title }}</h2>
      <p class="text-sm text-text-muted mb-3 text-pretty">{{ message }}</p>
      <p
        v-if="notice" data-test="restore-notice"
        class="mb-4 rounded-btn border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-text text-pretty"
      >{{ notice }}</p>

      <label class="block text-xs text-text-muted" :for="fieldId">Motif (obligatoire)</label>
      <textarea
        :id="fieldId" v-model="reason" data-test="restore-reason" rows="3" :disabled="busy"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-60"
      />
      <div class="mb-4 flex items-start justify-between gap-3 text-xs">
        <span data-test="restore-reason-hint" class="text-text-muted text-pretty">{{ reasonHint }}</span>
        <span
          data-test="restore-reason-count" class="shrink-0 tabular-nums"
          :class="reasonLength > RESTORE_REASON_MAX ? 'text-danger' : 'text-text-muted'"
        >{{ reasonLength }} / {{ RESTORE_REASON_MAX }}</span>
      </div>

      <p
        v-if="error" data-test="restore-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="restore-cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border transition-colors hover:bg-surface-elevated"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="button" data-test="restore-confirm" :disabled="!canConfirm"
          class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="onConfirm"
        >{{ busy ? 'En cours…' : confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>
