<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ page: number; totalPages: number }>()
const emit = defineEmits<{ change: [page: number] }>()
const isFirst = computed(() => props.page <= 0)
const isLast = computed(() => props.page >= props.totalPages - 1)
</script>

<template>
  <div class="flex items-center justify-end gap-3 text-sm">
    <button
      type="button" data-test="prev" :disabled="isFirst"
      class="rounded-btn px-3 py-1.5 border border-border disabled:opacity-40 hover:bg-surface-elevated transition-colors"
      @click="emit('change', props.page - 1)"
    >Précédent</button>
    <span class="text-text-muted tabular-nums">{{ props.page + 1 }} / {{ Math.max(props.totalPages, 1) }}</span>
    <button
      type="button" data-test="next" :disabled="isLast"
      class="rounded-btn px-3 py-1.5 border border-border disabled:opacity-40 hover:bg-surface-elevated transition-colors"
      @click="emit('change', props.page + 1)"
    >Suivant</button>
  </div>
</template>
