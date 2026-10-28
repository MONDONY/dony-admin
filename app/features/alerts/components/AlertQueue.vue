<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { alertSeverityMeta } from './alertSeverity'
import { alertSummary } from '@/features/alerts/lib/alertCatalog'
import { alertAge, type AgeTone, type AlertGroup } from '@/features/alerts/lib/alertWorkbench'
import type { AdminAlert } from '@/features/alerts/types/index'

const props = withDefaults(defineProps<{
  groups: AlertGroup[]
  loading: boolean
  error?: string | null
  /** Alerte affichée dans le dossier. */
  selectedId?: string | null
  /** Clés des groupes dépliés ; un groupe contenant l'alerte ouverte l'est toujours. */
  expanded?: string[]
  /** Horloge injectable (tests) pour l'âge des alertes. */
  now?: number
}>(), { error: null, selectedId: null, expanded: () => [], now: undefined })
const emit = defineEmits<{ select: [id: string]; toggle: [key: string]; retry: [] }>()

const AGE_TONE: Record<AgeTone, string> = {
  neutral: 'text-text-muted',
  warning: 'rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning',
  danger: 'rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger',
}
function age(a: AdminAlert) {
  const x = alertAge(a, props.now)
  return { label: x.label, cls: AGE_TONE[x.tone] }
}
const BORDER: Record<string, string> = { CRITICAL: 'border-l-danger', WARN: 'border-l-warning', INFO: 'border-l-primary' }
function isOpen(g: AlertGroup) {
  return props.expanded.includes(g.key) || g.alerts.some((a) => a.id === props.selectedId)
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <ul v-if="groups.length" class="flex flex-col gap-1.5 overflow-y-auto p-3" data-test="alert-queue">
      <li v-for="g in groups" :key="g.key" :data-test="`alert-group-${g.key}`">
        <!-- Groupe de plusieurs alertes du même type -->
        <template v-if="g.alerts.length > 1">
          <button
            type="button" :data-test="`alert-group-toggle-${g.key}`" :aria-expanded="isOpen(g) ? 'true' : 'false'"
            :class="['w-full rounded-btn border border-l-4 px-4 py-3 text-left transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.99]',
              BORDER[g.severity], 'border-y-transparent border-r-transparent']"
            @click="emit('toggle', g.key)"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span class="text-sm font-semibold text-pretty">{{ g.title }}</span>
              <span class="shrink-0 rounded-full bg-primary px-2 text-xs font-semibold tabular-nums text-white" :aria-label="`${g.alerts.length} alertes`">×{{ g.alerts.length }}</span>
            </span>
            <span class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-muted">
              <StatusBadge v-bind="alertSeverityMeta(g.severity)" />
              <span>{{ g.category }}</span>
              <span class="tabular-nums">· la plus ancienne : {{ age(g.alerts[0]!).label }}</span>
            </span>
          </button>
          <ul v-if="isOpen(g)" class="mb-1 ml-4 flex flex-col gap-1 border-l border-border pl-2">
            <li v-for="a in g.alerts" :key="a.id" :data-test="`alert-row-${a.id}`" :data-selected="selectedId === a.id ? 'true' : undefined">
              <button
                type="button" :data-test="`alert-open-${a.id}`" :aria-current="selectedId === a.id ? 'true' : undefined"
                :class="['w-full rounded-btn border px-4 py-2.5 text-left transition-[background-color,border-color,scale] active:scale-[0.99]',
                  selectedId === a.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-surface-elevated',
                  a.resolved ? 'text-text-muted' : '']"
                @click="emit('select', a.id)"
              >
                <span class="flex items-baseline justify-between gap-2">
                  <span class="truncate text-sm font-medium">{{ alertSummary(a) }}</span>
                  <span v-if="!a.resolved" :class="['shrink-0 text-xs tabular-nums', age(a).cls]">{{ age(a).label }}</span>
                  <span v-else class="shrink-0 text-xs text-success">Résolue</span>
                </span>
              </button>
            </li>
          </ul>
        </template>

        <!-- Alerte seule -->
        <div v-else :data-test="`alert-row-${g.alerts[0]!.id}`" :data-selected="selectedId === g.alerts[0]!.id ? 'true' : undefined">
          <button
            type="button" :data-test="`alert-open-${g.alerts[0]!.id}`" :aria-current="selectedId === g.alerts[0]!.id ? 'true' : undefined"
            :class="['w-full rounded-btn border border-l-4 px-4 py-3 text-left transition-[background-color,border-color,scale] active:scale-[0.99]',
              BORDER[g.severity],
              selectedId === g.alerts[0]!.id ? 'border-y-primary border-r-primary bg-primary/5' : 'border-y-transparent border-r-transparent hover:bg-surface-elevated',
              g.alerts[0]!.resolved ? 'text-text-muted' : '']"
            @click="emit('select', g.alerts[0]!.id)"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span class="text-sm font-semibold text-pretty">{{ g.title }}</span>
              <span v-if="!g.alerts[0]!.resolved" :class="['shrink-0 text-xs tabular-nums', age(g.alerts[0]!).cls]">{{ age(g.alerts[0]!).label }}</span>
              <span v-else class="shrink-0 text-xs text-success">Résolue</span>
            </span>
            <span class="mt-0.5 line-clamp-1 block text-xs text-text-muted">{{ alertSummary(g.alerts[0]!) }}</span>
            <span class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-muted">
              <StatusBadge v-bind="alertSeverityMeta(g.severity)" />
              <span>{{ g.category }}</span>
            </span>
          </button>
        </div>
      </li>
    </ul>
    <StateBlock :loading="loading" :error="error" :empty="groups.length === 0" empty-label="Aucune alerte" @retry="emit('retry')" />
  </div>
</template>
