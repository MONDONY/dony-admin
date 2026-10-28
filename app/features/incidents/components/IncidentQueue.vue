<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  incidentAge, incidentLabel, incidentStatusMeta, incidentSubtitle,
  type Incident, type IncidentGroup,
} from '@/features/incidents/lib/incidentWorkbench'

const props = withDefaults(defineProps<{
  groups: IncidentGroup[]
  loading: boolean
  error?: string | null
  /** Incident affiché dans le dossier. */
  selectedKey?: string | null
  /** Clés des groupes dépliés ; un groupe contenant l'incident ouvert l'est toujours. */
  expanded?: string[]
  /** Horloge injectable (tests) pour les délais. */
  now?: number
}>(), { error: null, selectedKey: null, expanded: () => [], now: undefined })
const emit = defineEmits<{ select: [key: string]; toggle: [key: string]; retry: [] }>()

const AGE_TONE = {
  neutral: 'text-text-muted',
  warning: 'rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning',
  danger: 'rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger',
} as const
function age(i: Incident) {
  const a = incidentAge(i, props.now)
  return a ? { label: a.label, cls: AGE_TONE[a.tone] } : null
}
const BORDER: Record<number, string> = { 4: 'border-l-danger', 3: 'border-l-danger', 2: 'border-l-warning', 1: 'border-l-border' }
const kindLabel = (i: Incident) => (i.kind === 'DISPUTE' ? 'Litige' : 'Absence')
function isOpen(g: IncidentGroup) {
  return props.expanded.includes(g.key) || g.incidents.some((i) => i.key === props.selectedKey)
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <ul v-if="groups.length" class="flex flex-col gap-1.5 overflow-y-auto p-3" data-test="incident-queue">
      <li v-for="g in groups" :key="g.key" :data-test="`incident-group-${g.key}`">
        <!-- Groupe de plusieurs incidents de même nature -->
        <template v-if="g.incidents.length > 1">
          <button
            type="button" :data-test="`incident-group-toggle-${g.key}`" :aria-expanded="isOpen(g) ? 'true' : 'false'"
            :class="['w-full rounded-btn border border-l-4 px-4 py-3 text-left transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.99]',
              BORDER[g.rank], 'border-y-transparent border-r-transparent']"
            @click="emit('toggle', g.key)"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span class="text-sm font-semibold text-pretty">{{ g.title }}</span>
              <span class="shrink-0 rounded-full bg-primary px-2 text-xs font-semibold tabular-nums text-white" :aria-label="`${g.incidents.length} incidents`">×{{ g.incidents.length }}</span>
            </span>
            <span class="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-text-muted">
              <span>{{ g.kind === 'DISPUTE' ? 'Litiges' : 'Absences déclarées' }}</span>
              <span v-if="age(g.incidents[0]!)" class="tabular-nums">· le plus ancien : {{ age(g.incidents[0]!)!.label }}</span>
            </span>
          </button>
          <ul v-if="isOpen(g)" class="mb-1 ml-4 flex flex-col gap-1 border-l border-border pl-2">
            <li v-for="i in g.incidents" :key="i.key" :data-test="`incident-row-${i.key}`" :data-selected="selectedKey === i.key ? 'true' : undefined">
              <button
                type="button" :data-test="`incident-open-${i.key}`" :aria-current="selectedKey === i.key ? 'true' : undefined"
                :class="['w-full rounded-btn border px-4 py-2.5 text-left transition-[background-color,border-color,scale] active:scale-[0.99]',
                  selectedKey === i.key ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-surface-elevated',
                  i.todo ? '' : 'text-text-muted']"
                @click="emit('select', i.key)"
              >
                <span class="flex items-baseline justify-between gap-2">
                  <span class="truncate text-sm font-medium">{{ incidentLabel(i) }}</span>
                  <span v-if="age(i)" :class="['shrink-0 text-xs tabular-nums', age(i)!.cls]">{{ age(i)!.label }}</span>
                  <span v-else class="shrink-0 text-xs text-success">Traité</span>
                </span>
                <span v-if="incidentSubtitle(i)" class="mt-0.5 line-clamp-1 block text-xs text-text-muted">{{ incidentSubtitle(i) }}</span>
              </button>
            </li>
          </ul>
        </template>

        <!-- Incident seul -->
        <div v-else :data-test="`incident-row-${g.incidents[0]!.key}`" :data-selected="selectedKey === g.incidents[0]!.key ? 'true' : undefined">
          <button
            type="button" :data-test="`incident-open-${g.incidents[0]!.key}`" :aria-current="selectedKey === g.incidents[0]!.key ? 'true' : undefined"
            :class="['w-full rounded-btn border border-l-4 px-4 py-3 text-left transition-[background-color,border-color,scale] active:scale-[0.99]',
              BORDER[g.rank],
              selectedKey === g.incidents[0]!.key ? 'border-y-primary border-r-primary bg-primary/5' : 'border-y-transparent border-r-transparent hover:bg-surface-elevated',
              g.incidents[0]!.todo ? '' : 'text-text-muted']"
            @click="emit('select', g.incidents[0]!.key)"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span class="text-sm font-semibold text-pretty">{{ g.title }}</span>
              <span v-if="age(g.incidents[0]!)" :class="['shrink-0 text-xs tabular-nums', age(g.incidents[0]!)!.cls]">{{ age(g.incidents[0]!)!.label }}</span>
              <span v-else class="shrink-0 text-xs text-success">Traité</span>
            </span>
            <span class="mt-0.5 line-clamp-1 block text-xs text-text-muted">{{ incidentLabel(g.incidents[0]!) }}</span>
            <span class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-muted">
              <StatusBadge v-bind="incidentStatusMeta(g.incidents[0]!)" />
              <span>{{ kindLabel(g.incidents[0]!) }}</span>
              <span v-if="incidentSubtitle(g.incidents[0]!)">· {{ incidentSubtitle(g.incidents[0]!) }}</span>
            </span>
          </button>
        </div>
      </li>
    </ul>
    <StateBlock :loading="loading" :error="error" :empty="groups.length === 0" empty-label="Aucun incident" @retry="emit('retry')" />
  </div>
</template>
