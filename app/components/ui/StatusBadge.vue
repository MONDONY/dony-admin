<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }>()
const toneClass = computed(() => ({
  neutral: 'bg-border/40 text-text-muted',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-primary/15 text-primary',
}[props.tone ?? 'neutral']))
</script>

<template>
  <span :class="['inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', toneClass]">
    {{ label }}
  </span>
</template>
