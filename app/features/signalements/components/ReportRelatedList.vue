<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { reportStatusMeta } from './reportStatus'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import type { RelatedReport } from '@/features/signalements/types/index'

/** Signalements voisins (même cible, ou même écran) : un clic ouvre le dossier. */
defineProps<{ items: RelatedReport[] }>()
const emit = defineEmits<{ open: [id: string] }>()

function when(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR')
}
</script>

<template>
  <ul class="divide-y divide-border">
    <li v-for="o in items" :key="o.id">
      <button
        type="button" :data-test="`related-${o.id}`"
        class="flex w-full items-center justify-between gap-3 py-2 text-left text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.99]"
        @click="emit('open', o.id)"
      >
        <span class="min-w-0">
          <span class="block truncate font-medium">{{ o.reason ? reportReasonLabel(o.reason) : 'Motif inconnu' }}</span>
          <span class="block truncate text-xs text-text-muted">{{ o.reporterName ?? 'Signalant inconnu' }} · {{ when(o.createdAt) }}</span>
        </span>
        <StatusBadge v-if="o.status" v-bind="reportStatusMeta(o.status as 'OPEN' | 'RESOLVED' | 'DISMISSED')" />
      </button>
    </li>
  </ul>
</template>
