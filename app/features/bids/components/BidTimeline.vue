<script setup lang="ts">
import type { AdminBidTimeline } from '@/features/bids/types/index'

defineProps<{ timeline: AdminBidTimeline | null }>()

function fmt(d: string) {
  return new Date(d).toLocaleString('fr-FR')
}
</script>

<template>
  <ol class="space-y-3">
    <li
      v-for="(e, i) in (timeline?.entries ?? [])"
      :key="i"
      data-test="timeline-entry"
      class="flex gap-3"
    >
      <div class="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-text">{{ e.label }} <span class="text-xs text-text-muted">· {{ e.kind }}</span></p>
        <p v-if="e.detail" class="text-xs text-text-muted">{{ e.detail }}</p>
        <p v-if="e.gpsLat != null && e.gpsLon != null" class="text-xs text-text-muted tabular-nums">{{ e.gpsLat }}, {{ e.gpsLon }}</p>
        <img v-if="e.photoUrl" :src="e.photoUrl" alt="" class="mt-1 h-20 rounded-xs border border-border object-cover">
        <p class="text-[11px] text-text-muted tabular-nums">{{ fmt(e.at) }}</p>
      </div>
    </li>
  </ol>
</template>
