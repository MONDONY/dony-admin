<script setup lang="ts">
import type { TimelineItem } from '@/features/signalements/reportContext'

/** Chronologie du dossier, du plus ancien au plus récent. */
defineProps<{ items: TimelineItem[] }>()

function when(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR')
}
</script>

<template>
  <ol class="flex flex-col gap-3 text-sm" data-test="report-timeline">
    <li v-for="(item, i) in items" :key="item.key" class="flex gap-3" :data-test="`timeline-${i}`">
      <span
        aria-hidden="true"
        :class="['mt-1.5 size-2 shrink-0 rounded-full', i === items.length - 1 ? 'bg-primary' : 'bg-border']"
      />
      <span class="min-w-0">
        <span class="font-medium">{{ item.label }}</span>
        <span class="block text-xs text-text-muted tabular-nums">
          {{ when(item.at) }}<template v-if="item.by"> · {{ item.by }}</template>
        </span>
        <span v-if="item.note" class="mt-0.5 block text-xs text-text-muted text-pretty">« {{ item.note }} »</span>
      </span>
    </li>
  </ol>
</template>
