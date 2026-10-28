<script setup lang="ts">
import { computed } from 'vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { reportStatusMeta } from './reportStatus'
import { reportKind, reportKindLabel } from '@/features/signalements/reportKind'
import { reportTargetTypeLabel } from '@/features/signalements/reportActionLabels'
import { reportReasonTitle, reportTargetLabel } from '@/features/signalements/reportDisplay'
import { isOpenReport, reportAge } from '@/features/signalements/reportWorkbench'
import type { AdminReport } from '@/features/signalements/types/index'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(defineProps<{
  reports: AdminReport[]
  loading: boolean
  /** Signalement affiché dans le dossier. */
  selectedId?: string | null
  /** Identifiants cochés ; les cases n'apparaissent qu'avec REPORT_DELETE. */
  checked?: string[]
  /** Horloge injectable (tests) pour l'âge des signalements. */
  now?: number
}>(), { selectedId: null, checked: () => [], now: undefined })
const emit = defineEmits<{ select: [id: string]; toggle: [id: string]; togglePage: [] }>()

const auth = useAuthStore()
const canDelete = computed(() => auth.can('REPORT_DELETE'))
const allChecked = computed(() => props.reports.length > 0 && props.reports.every((r) => props.checked.includes(r.id)))
const someChecked = computed(() => !allChecked.value && props.reports.some((r) => props.checked.includes(r.id)))

const AGE_TONE = {
  neutral: 'text-text-muted',
  warning: 'rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning',
  danger: 'rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger',
} as const
function age(r: AdminReport) {
  const a = reportAge(r.createdAt, props.now)
  return { label: a.tone === 'danger' ? `${a.label} · en retard` : a.label, cls: AGE_TONE[a.tone] }
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <label v-if="canDelete && reports.length" class="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-text-muted">
      <input
        type="checkbox" data-test="select-page" aria-label="Sélectionner la page"
        :checked="allChecked" :indeterminate.prop="someChecked"
        @change="emit('togglePage')"
      >
      Sélectionner la page
    </label>

    <ul v-if="reports.length" class="flex flex-col gap-1.5 overflow-y-auto p-3" data-test="report-queue">
      <li
        v-for="r in reports" :key="r.id" :data-test="`report-row-${r.id}`"
        :data-selected="selectedId === r.id ? 'true' : undefined"
        class="flex items-start gap-1"
      >
        <input
          v-if="canDelete" type="checkbox" :data-test="`select-${r.id}`" aria-label="Sélectionner le signalement"
          class="mt-4 ml-2 shrink-0"
          :checked="checked.includes(r.id)"
          @change="emit('toggle', r.id)"
        >
        <button
          type="button" :data-test="`report-open-${r.id}`"
          :aria-current="selectedId === r.id ? 'true' : undefined"
          :class="['min-w-0 flex-1 rounded-btn border px-4 py-3 text-left transition-[background-color,border-color,scale] active:scale-[0.99]',
            selectedId === r.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-surface-elevated',
            r.deletedAt ? 'text-text-muted' : '']"
          @click="emit('select', r.id)"
        >
          <span class="flex items-baseline justify-between gap-2">
            <span class="truncate text-sm font-semibold">{{ reportTargetLabel(r) }}</span>
            <span v-if="isOpenReport(r)" :class="['shrink-0 text-xs tabular-nums', age(r).cls]">{{ age(r).label }}</span>
            <StatusBadge v-else class="shrink-0" v-bind="reportStatusMeta(r.status)" />
          </span>
          <span class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-muted">
            <StatusBadge
              v-if="reportKind(r)" :data-test="`report-kind-${r.id}`"
              :label="reportKindLabel(reportKind(r)!)"
              :tone="reportKind(r) === 'BUG' ? 'danger' : reportKind(r) === 'AVIS' ? 'info' : 'success'"
            />
            <StatusBadge v-else :label="reportTargetTypeLabel(r.targetType)" />
            <span class="truncate">{{ reportReasonTitle(r) }}</span>
          </span>
          <span class="mt-1 block truncate text-xs text-text-muted">Signalé par {{ r.reporterName ?? 'Inconnu' }}</span>
        </button>
      </li>
    </ul>

    <StateBlock :loading="loading" :empty="reports.length === 0" empty-label="Aucun signalement" />
  </div>
</template>
