<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AdminNoShow, NoShowDecision } from '@/features/incidents/types/index'
import { NOSHOW_REASON_MAX, NOSHOW_REASON_MIN } from '@/features/incidents/types/index'
import { decisionEffect, noShowSentence } from './noShowLabels'

const props = defineProps<{ open: boolean; decision: NoShowDecision; row: AdminNoShow; busy: boolean; error: string | null }>()
const emit = defineEmits<{ submit: [reason: string]; cancel: [] }>()

const reason = ref('')
const field = ref<HTMLTextAreaElement | null>(null)
watch(() => props.open, async (o) => {
  if (!o) return
  reason.value = ''
  await nextTick()
  field.value?.focus()
}, { immediate: true })

/** L'ancien endpoint ne prend pas de motif : on n'en réclame pas un qui serait perdu. */
const needsReason = computed(() => !props.row.legacy)
const length = computed(() => reason.value.trim().length)
const valid = computed(() => !needsReason.value || (length.value >= NOSHOW_REASON_MIN && reason.value.length <= NOSHOW_REASON_MAX))
const title = computed(() => (props.decision === 'confirm' ? 'Confirmer l’absence' : 'Rejeter la déclaration'))
const effect = computed(() => decisionEffect(props.row, props.decision))

function submit() { if (valid.value && !props.busy) emit('submit', reason.value) }
function cancel() { if (!props.busy) emit('cancel') }
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="cancel">
    <div
      data-test="noshow-dialog" role="dialog" aria-modal="true" aria-labelledby="noshow-dialog-title"
      class="w-full max-w-md rounded-card bg-surface p-6 shadow-[0_0_0_1px_rgb(var(--border-rgb)),0_12px_32px_rgba(0,0,0,0.18)]"
      @keydown.esc.stop="cancel"
    >
      <h2 id="noshow-dialog-title" class="font-display text-lg font-semibold text-balance">{{ title }}</h2>
      <p class="mt-1 text-sm text-text-muted text-pretty">{{ noShowSentence(row) }}</p>
      <ul class="mt-4 space-y-1.5 rounded-xs bg-surface-elevated px-3 py-2.5 text-sm">
        <li v-for="line in effect" :key="line" class="text-pretty">{{ line }}</li>
      </ul>

      <div v-if="needsReason" class="mt-4">
        <label for="noshow-dialog-reason" class="mb-1 block text-xs text-text-muted">Motif interne (obligatoire, non transmis aux parties)</label>
        <textarea
          id="noshow-dialog-reason" ref="field" v-model="reason" data-test="noshow-dialog-reason" rows="4"
          :maxlength="NOSHOW_REASON_MAX" :disabled="busy"
          placeholder="Ce que vous avez vérifié (appel, photos, échanges…)"
          class="w-full rounded-xs border border-border bg-bg p-2 text-sm disabled:opacity-60"
        />
        <div class="mt-1 flex justify-between text-xs text-text-muted">
          <span>{{ NOSHOW_REASON_MIN }} caractères minimum</span>
          <span data-test="noshow-dialog-count" :class="['tabular-nums', reason.length > NOSHOW_REASON_MAX ? 'text-danger' : '']">{{ length }} / {{ NOSHOW_REASON_MAX }}</span>
        </div>
      </div>

      <p
        v-if="error" data-test="noshow-dialog-error" role="alert"
        class="mt-4 rounded-xs border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button" data-test="noshow-dialog-cancel" :disabled="busy"
          class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
          @click="cancel"
        >Annuler</button>
        <button
          type="button" data-test="noshow-dialog-submit" :disabled="!valid || busy" :aria-busy="busy"
          :class="['rounded-btn px-4 py-2 text-sm text-white transition-[background-color,transform] active:scale-[0.96] disabled:opacity-40',
                   decision === 'confirm' ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary/90']"
          @click="submit"
        >{{ busy ? 'En cours…' : title }}</button>
      </div>
    </div>
  </div>
</template>
