<script setup lang="ts">
import { ref, watch } from 'vue'
const props = defineProps<{
  open: boolean; title: string; message: string; confirmLabel: string; requireReason?: boolean
}>()
const emit = defineEmits<{ confirm: [reason: string]; cancel: [] }>()
const reason = ref('')
watch(() => props.open, (o) => { if (o) reason.value = '' })
const canConfirm = () => !props.requireReason || reason.value.trim().length > 0
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-test="overlay">
    <div class="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-xl">
      <h2 class="font-display text-lg font-semibold mb-1">{{ title }}</h2>
      <p class="text-sm text-text-muted mb-4">{{ message }}</p>
      <textarea
        v-if="requireReason" data-test="reason" v-model="reason" rows="3"
        placeholder="Motif (obligatoire)"
        class="w-full rounded-btn border border-border bg-bg p-2 text-sm mb-4"
      />
      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="button" data-test="confirm" :disabled="!canConfirm()"
          class="rounded-btn px-4 py-2 text-sm bg-danger text-white disabled:opacity-40 hover:bg-danger/90"
          @click="emit('confirm', reason)"
        >{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>
