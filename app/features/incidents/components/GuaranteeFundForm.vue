<script setup lang="ts">
import { ref, computed } from 'vue'
import { GUARANTEE_FUND_MAX_CENTS } from '@/features/incidents/types/index'

const emit = defineEmits<{ submit: [amountCents: number, reason: string] }>()

const euros = ref('')
const reason = ref('')

const cents = computed(() => Math.round(parseFloat(euros.value || '0') * 100))
const valid = computed(() => cents.value > 0 && cents.value <= GUARANTEE_FUND_MAX_CENTS && reason.value.trim().length > 0)

function submit() {
  if (valid.value) emit('submit', cents.value, reason.value.trim())
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface p-4 space-y-3">
    <p class="text-sm font-semibold">Fonds de garantie <span class="text-xs text-text-muted">(max 200 €)</span></p>
    <input
      data-test="gf-amount"
      v-model="euros"
      type="number"
      min="0"
      max="200"
      step="0.01"
      placeholder="Montant €"
      class="w-full rounded-btn border border-border bg-bg px-3 py-2 text-sm tabular-nums"
    >
    <textarea
      data-test="gf-reason"
      v-model="reason"
      rows="2"
      placeholder="Motif"
      class="w-full rounded-btn border border-border bg-bg px-3 py-2 text-sm"
    />
    <button
      data-test="gf-submit"
      type="button"
      :disabled="!valid"
      class="rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
      @click="submit"
    >Activer le fonds de garantie</button>
  </div>
</template>
