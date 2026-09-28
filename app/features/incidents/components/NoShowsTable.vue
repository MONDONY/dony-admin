<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminNoShow } from '@/features/incidents/types/index'
import {
  amountLabel, disputeHref, disputeLinkLabel, formatDateTime, noShowSentence, noShowStatusMeta, noShowTitle, remainingMeta, scopeMeta, tripLabel,
} from './noShowLabels'

const props = defineProps<{ rows: AdminNoShow[]; loading: boolean; now?: number }>()
const emit = defineEmits<{ select: [row: AdminNoShow] }>()

const remaining = (r: AdminNoShow) => remainingMeta(r, props.now ?? Date.now())
function details(r: AdminNoShow): string[] {
  const handover = formatDateTime(r.handoverAt)
  return [tripLabel(r.trip), handover ? `Remise prévue le ${handover}` : null, amountLabel(r)].filter((x): x is string => !!x)
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <ul v-if="rows.length" class="divide-y divide-border">
      <li
        v-for="r in rows" :key="r.id" :data-test="`noshow-row-${r.id}`"
        role="button" tabindex="0"
        class="flex cursor-pointer flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between"
        @click="emit('select', r)"
        @keydown.enter.prevent="emit('select', r)"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge v-if="r.scope" v-bind="scopeMeta(r.scope)" />
            <p class="text-sm font-medium text-pretty">{{ noShowTitle(r) }}</p>
          </div>
          <p v-if="r.legacy" class="mt-0.5 text-sm text-text-muted text-pretty">{{ noShowSentence(r) }}</p>
          <p v-if="details(r).length" class="mt-1 text-xs text-text-muted tabular-nums">{{ details(r).join(' · ') }}</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <NuxtLink
            v-if="r.dispute" :to="disputeHref(r.dispute)" :data-test="`noshow-dispute-${r.id}`"
            class="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/25"
            @click.stop
          >{{ disputeLinkLabel(r.dispute) }}</NuxtLink>
          <StatusBadge v-bind="noShowStatusMeta(r.status)" />
          <span
            v-if="remaining(r)" :data-test="`noshow-remaining-${r.id}`"
            :class="['text-xs font-medium tabular-nums', remaining(r)!.urgent ? 'text-danger' : 'text-text-muted']"
          >{{ remaining(r)!.label }}</span>
        </div>
      </li>
    </ul>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="rows.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune déclaration d’absence pour ces filtres</p>
  </div>
</template>
