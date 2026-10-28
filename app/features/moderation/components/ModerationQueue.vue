<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { oldestReport, participantsLabel, reportAge, type QueueGroup } from '@/features/moderation/lib/moderationWorkbench'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import { formatInstant } from '@/features/user-profile/lib/formatInstant'
import { serverDateIso } from '@/lib/serverDate'

const props = withDefaults(defineProps<{
  groups: QueueGroup[]
  loading: boolean
  error?: string | null
  /** Conversation affichée au centre. */
  selectedId?: string | null
  /** Horloge injectable (tests) pour l'ancienneté. */
  now?: number
}>(), { error: null, selectedId: null, now: undefined })
const emit = defineEmits<{ select: [id: string]; retry: [] }>()

const AGE_TONE = {
  neutral: 'text-text-muted',
  warning: 'rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning',
  danger: 'rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger',
} as const
const BORDER: Record<string, string> = { REPORTED: 'border-l-danger', RECENT: 'border-l-border' }

function age(c: QueueGroup['items'][number]) {
  const r = oldestReport(c)
  const a = r ? reportAge(r.createdAt, props.now) : null
  return a ? { label: a.label, cls: AGE_TONE[a.tone] } : null
}
const reasons = (c: QueueGroup['items'][number]) => [...new Set(c.reports.map((r) => reportReasonLabel(r.reason)))]
const lastSeen = (c: QueueGroup['items'][number]) => (c.lastMessageAt ? formatInstant(serverDateIso(c.lastMessageAt)) : null)
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <ul v-if="groups.length" class="flex flex-col overflow-y-auto" data-test="moderation-queue">
      <li v-for="g in groups" :key="g.key" :data-test="`moderation-group-${g.key}`">
        <div class="flex items-center justify-between border-y border-border bg-bg/60 px-4 py-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">{{ g.title }}</span>
          <span class="rounded-full bg-surface-elevated px-2 text-xs font-semibold tabular-nums text-text-muted">{{ g.items.length }}</span>
        </div>
        <ul class="flex flex-col gap-1.5 p-3">
          <li v-for="c in g.items" :key="c.id" :data-test="`conv-row-${c.id}`" :data-selected="selectedId === c.id ? 'true' : undefined">
            <button
              type="button" :data-test="`open-${c.id}`" :aria-current="selectedId === c.id ? 'true' : undefined"
              :class="['w-full rounded-btn border border-l-4 px-4 py-3 text-left transition-[background-color,border-color,scale] active:scale-[0.99]',
                BORDER[g.key],
                selectedId === c.id ? 'border-y-primary border-r-primary bg-primary/5' : 'border-y-transparent border-r-transparent hover:bg-surface-elevated']"
              @click="emit('select', c.id)"
            >
              <span class="flex items-baseline justify-between gap-2">
                <span class="min-w-0 truncate text-sm font-semibold">{{ participantsLabel(c) }}</span>
                <span v-if="age(c)" :class="['shrink-0 text-xs tabular-nums', age(c)!.cls]" :data-test="`conv-age-${c.id}`">{{ age(c)!.label }}</span>
                <span v-else-if="lastSeen(c)" class="shrink-0 text-xs text-text-muted">{{ lastSeen(c) }}</span>
              </span>
              <span v-if="c.lastMessagePreview" class="mt-0.5 block truncate text-xs text-text-muted" :data-test="`conv-preview-${c.id}`">{{ c.lastMessagePreview }}</span>
              <span v-if="c.openReportCount > 0" class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <StatusBadge v-for="r in reasons(c)" :key="r" :data-test="`conv-flagged-${c.id}`" :label="r" tone="danger" />
                <StatusBadge v-if="reasons(c).length === 0" :data-test="`conv-flagged-${c.id}`" label="Signalée" tone="danger" />
                <span v-if="c.openReportCount > 1" class="text-text-muted">{{ c.openReportCount }} signalements</span>
              </span>
              <span v-if="c.closedAt" class="mt-1 block text-xs text-text-muted">Conversation fermée</span>
            </button>
          </li>
        </ul>
      </li>
    </ul>
    <StateBlock :loading="loading" :error="error" :empty="groups.length === 0" empty-label="Aucune conversation" @retry="emit('retry')" />
  </div>
</template>
