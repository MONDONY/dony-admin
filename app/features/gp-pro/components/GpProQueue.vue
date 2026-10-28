<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import { ageLabel, applicantName } from '@/features/gp-pro/lib/gpProWorkbench'
import type { GpProScope } from '@/features/gp-pro/lib/gpProWorkbench'
import { frequencyLabel, reviewReasonLabel, sourceLabel } from '@/features/gp-pro/types/index'
import type { AdminGpProApplicationRow, AdminGpProReviewRow } from '@/features/gp-pro/types/index'

/** File du poste : les demandes à examiner ou les titulaires à revoir, les plus anciens d'abord. */
withDefaults(defineProps<{
  scope: GpProScope
  applications: AdminGpProApplicationRow[]
  review: AdminGpProReviewRow[]
  loading: boolean
  error?: string | null
  /** Demande (`applicationId`) ou titulaire (`userId`) affiché au centre. */
  selectedId?: string | null
  now?: number
}>(), { error: null, selectedId: null, now: undefined })
const emit = defineEmits<{ select: [id: string]; retry: [] }>()

// Les justificatifs sont facultatifs : leur absence ne s'affiche pas, jamais comme un manque.
function docsLabel(n: number) {
  return `${n} justificatif${n > 1 ? 's' : ''}`
}
const rowClass = (selected: boolean) => ['w-full rounded-btn border border-l-4 border-l-border px-4 py-3 text-left transition-[background-color,border-color,scale] active:scale-[0.99]',
  selected ? 'border-y-primary border-r-primary bg-primary/5' : 'border-y-transparent border-r-transparent hover:bg-surface-elevated']
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <template v-if="scope === 'demandes'">
      <ul v-if="applications.length" class="flex flex-col gap-1.5 overflow-y-auto p-3" data-test="gp-pro-queue">
        <li v-for="r in applications" :key="r.applicationId" :data-test="`gp-pro-row-${r.applicationId}`" :data-selected="selectedId === r.applicationId ? 'true' : undefined">
          <button
            type="button" :data-test="`open-${r.applicationId}`" :aria-current="selectedId === r.applicationId ? 'true' : undefined"
            :aria-label="`Ouvrir la demande de ${applicantName(r)}`"
            :class="rowClass(selectedId === r.applicationId)"
            @click="emit('select', r.applicationId)"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span :class="['min-w-0 truncate text-sm font-semibold', r.displayName ? '' : 'italic text-text-muted']">{{ applicantName(r) }}</span>
              <span v-if="ageLabel(r.createdAt, now)" class="shrink-0 text-xs tabular-nums text-text-muted" :data-test="`gp-pro-age-${r.applicationId}`">{{ ageLabel(r.createdAt, now) }}</span>
            </span>
            <span class="mt-0.5 block truncate text-xs text-text-muted">
              {{ frequencyLabel(r.travelFrequency) }} · {{ sourceLabel(r.source) }}<template v-if="r.documentCount"> · <span class="tabular-nums" :data-test="`gp-pro-docs-${r.applicationId}`">{{ docsLabel(r.documentCount) }}</span></template>
            </span>
          </button>
        </li>
      </ul>
      <StateBlock :loading="loading" :error="error" :empty="applications.length === 0" empty-label="Aucune demande à examiner" empty-test="gp-pro-empty" @retry="emit('retry')" />
    </template>

    <template v-else>
      <ul v-if="review.length" class="flex flex-col gap-1.5 overflow-y-auto p-3" data-test="gp-pro-review-queue">
        <li v-for="r in review" :key="r.userId" :data-test="`gp-pro-review-${r.userId}`" :data-selected="selectedId === r.userId ? 'true' : undefined">
          <button
            type="button" :data-test="`open-${r.userId}`" :aria-current="selectedId === r.userId ? 'true' : undefined"
            :aria-label="`Ouvrir le titulaire ${applicantName(r)}`"
            :class="rowClass(selectedId === r.userId)"
            @click="emit('select', r.userId)"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span :class="['min-w-0 truncate text-sm font-semibold', r.displayName ? '' : 'italic text-text-muted']">{{ applicantName(r) }}</span>
              <span v-if="ageLabel(r.detectedAt, now)" class="shrink-0 text-xs tabular-nums text-text-muted">{{ ageLabel(r.detectedAt, now) }}</span>
            </span>
            <span class="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                v-for="f in r.flags ?? []" :key="f.flagId"
                class="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
              >{{ reviewReasonLabel(f.reason) }}</span>
            </span>
          </button>
        </li>
      </ul>
      <StateBlock :loading="loading" :error="error" :empty="review.length === 0" empty-label="Aucun titulaire à revoir" empty-test="gp-pro-review-empty" @retry="emit('retry')" />
    </template>
  </div>
</template>
