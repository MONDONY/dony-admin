<script setup lang="ts">
import { PERIOD_CHIPS } from '@/features/mobile/lib/mobileOverview'
import type { OverviewPeriod } from '@/features/overview/types/index'

defineProps<{ modelValue: OverviewPeriod }>()
const emit = defineEmits<{ 'update:modelValue': [period: OverviewPeriod] }>()
</script>

<template>
  <div class="flex gap-2 overflow-x-auto" role="tablist" aria-label="Période">
    <button
      v-for="c in PERIOD_CHIPS" :key="c.key" type="button" role="tab" data-test="period-chip"
      :data-chip="c.key" :aria-selected="modelValue === c.key"
      class="min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold"
      :class="modelValue === c.key ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text'"
      @click="emit('update:modelValue', c.key)"
    >{{ c.label }}</button>
  </div>
</template>
