<script setup lang="ts">
import { computed } from 'vue'
import type { QueueCard } from '@/features/overview/composables/useOverview'
const props = defineProps<{ card: QueueCard }>()
const toneClass = computed(() => ({
  danger: 'text-danger', warning: 'text-warning', info: 'text-primary', neutral: 'text-text-muted',
}[props.card.tone]))
</script>

<template>
  <NuxtLink
    :to="card.href" :data-test="`queue-${card.id}`"
    class="bg-surface border border-border rounded-card p-4 flex items-center justify-between hover:border-primary/40 transition-colors"
  >
    <span class="text-sm text-text">{{ card.label }}</span>
    <span :class="['text-lg font-bold tabular-nums', toneClass]">{{ card.count }}</span>
  </NuxtLink>
</template>
