<script setup lang="ts">
defineProps<{ id: string; label: string; value: string; subLabel?: string }>()
</script>

<template>
  <div :data-test="`kpi-${id}`" class="bg-surface border border-border rounded-card p-5 flex flex-col gap-1">
    <p class="text-xs font-medium text-text-muted uppercase tracking-wider">{{ label }}</p>
    <p class="text-2xl font-bold text-text font-display tabular-nums">{{ value }}</p>
    <p v-if="subLabel" class="text-xs text-text-muted">{{ subLabel }}</p>
  </div>
</template>
