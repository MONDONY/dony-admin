<script setup lang="ts">
import type { ModeFilterOption, TransportModeFilter } from '@/lib/transportModes'

defineProps<{ options: ModeFilterOption[]; modelValue: TransportModeFilter; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [TransportModeFilter] }>()
</script>

<template>
  <div role="radiogroup" :aria-label="label ?? 'Mode de transport'" class="flex flex-wrap gap-1">
    <button
      v-for="o in options" :key="o.value" type="button" role="radio"
      :data-test="`mode-filter-${o.value}`" :aria-checked="modelValue === o.value"
      :class="['rounded-full px-3 py-1 text-xs transition-colors',
        modelValue === o.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
      @click="emit('update:modelValue', o.value)"
    >{{ o.label }}</button>
  </div>
</template>
