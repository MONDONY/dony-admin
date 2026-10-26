<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { categoryLabel } from '@/features/support/utils/format'
import { priorityMeta, ticketGroupOf, waitingAge, type TicketGroup } from '@/features/support/lib/supportWorkbench'
import type { AdminSupportTicket } from '@/features/support/types/index'
import { parseServerDate, serverDateIso } from '@/lib/serverDate'

const props = withDefaults(defineProps<{
  groups: TicketGroup[]
  loading: boolean
  error?: string | null
  /** Ticket affiché dans la conversation. */
  selectedId?: string | null
  /** Utilisateur connecté : « moi » plutôt que mon adresse. */
  myId?: string | null
  /** Horloge injectable (tests) pour l'ancienneté. */
  now?: number
}>(), { error: null, selectedId: null, myId: null, now: undefined })
const emit = defineEmits<{ select: [id: string]; retry: [] }>()

const AGE_TONE = {
  neutral: 'text-text-muted',
  warning: 'rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning',
  danger: 'rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger',
} as const
const BORDER: Record<string, string> = { TO_ANSWER: 'border-l-danger', WAITING_USER: 'border-l-primary', RESOLVED: 'border-l-border' }

function age(t: AdminSupportTicket) {
  const a = waitingAge(t, props.now)
  return a ? { label: a.label, cls: AGE_TONE[a.tone] } : null
}
const CAPTION = { TO_ANSWER: 'à répondre', WAITING_USER: 'sans retour', RESOLVED: '' } as const
const caption = (t: AdminSupportTicket) => CAPTION[ticketGroupOf(t)]
function resolvedOn(t: AdminSupportTicket): string {
  const at = parseServerDate(serverDateIso(t.resolvedAt ?? ''))
  return Number.isNaN(at) ? 'Résolu' : `Résolu le ${new Date(at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' })}`
}
function owner(t: AdminSupportTicket): string | null {
  if (!t.assignedAdminId) return null
  return t.assignedAdminId === props.myId ? 'Moi' : (t.assignedAdminEmail ?? 'Assigné')
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <ul v-if="groups.length" class="flex flex-col overflow-y-auto" data-test="support-queue">
      <li v-for="g in groups" :key="g.key" :data-test="`support-group-${g.key}`">
        <div class="flex items-center justify-between border-y border-border bg-bg/60 px-3.5 py-1.5">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">{{ g.title }}</span>
          <span class="rounded-full bg-surface-elevated px-2 text-xs font-semibold tabular-nums text-text-muted">{{ g.tickets.length }}</span>
        </div>
        <ul class="flex flex-col gap-0.5 p-1.5">
          <li v-for="t in g.tickets" :key="t.id" :data-test="`support-row-${t.id}`" :data-selected="selectedId === t.id ? 'true' : undefined">
            <button
              type="button" :data-test="`support-open-${t.id}`" :aria-current="selectedId === t.id ? 'true' : undefined"
              :class="['w-full rounded-btn border border-l-4 px-3 py-2.5 text-left transition-[background-color,border-color,scale] active:scale-[0.99]',
                BORDER[g.key],
                selectedId === t.id ? 'border-y-primary border-r-primary bg-primary/5' : 'border-y-transparent border-r-transparent hover:bg-surface-elevated',
                g.key === 'RESOLVED' ? 'text-text-muted' : '']"
              @click="emit('select', t.id)"
            >
              <span class="flex items-baseline justify-between gap-2">
                <span class="min-w-0 truncate text-sm font-semibold">{{ t.subject }}</span>
                <span v-if="age(t)" :class="['shrink-0 text-xs tabular-nums', age(t)!.cls]">{{ age(t)!.label }}</span>
                <span v-else class="shrink-0 text-xs text-success">{{ resolvedOn(t) }}</span>
              </span>
              <span class="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-text-muted">
                <span class="min-w-0 truncate">{{ t.userDisplayName }}</span>
                <span v-if="caption(t)" class="shrink-0">{{ caption(t) }}</span>
              </span>
              <span class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <StatusBadge :label="categoryLabel(t.category)" tone="neutral" />
                <StatusBadge v-if="priorityMeta(t.priority)" v-bind="priorityMeta(t.priority)!" />
                <span v-if="owner(t)" class="text-text-muted" :data-test="`support-owner-${t.id}`">{{ owner(t) }}</span>
                <span v-else-if="g.key !== 'RESOLVED'" class="font-medium text-warning">Non assigné</span>
              </span>
            </button>
          </li>
        </ul>
      </li>
    </ul>
    <StateBlock :loading="loading" :error="error" :empty="groups.length === 0" empty-label="Aucun ticket" @retry="emit('retry')" />
  </div>
</template>
