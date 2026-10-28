<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { kycDisplayName } from '@/features/kyc/lib/kycWorkbench'
import type { KycQueueGroup } from '@/features/kyc/lib/kycWorkbench'
import {
  formatWaiting, isOverdue, kycDecisionCodeLabel, kycDecisionMeta, kycProviderLabel, kycStatusMeta,
} from '@/features/kyc/types/index'
import type { AdminKycQueueItem } from '@/features/kyc/types/index'

withDefaults(defineProps<{
  groups: KycQueueGroup[]
  loading: boolean
  error?: string | null
  /** Dossier affiché au centre. */
  selectedId?: string | null
}>(), { error: null, selectedId: null })
const emit = defineEmits<{ select: [userId: string]; retry: [] }>()

const BORDER: Record<string, string> = { OVERDUE: 'border-l-danger', ON_TIME: 'border-l-border', ALL: 'border-l-border' }

function waiting(r: AdminKycQueueItem) {
  if (r.waitingHours === null || r.waitingHours === undefined) return null
  const overdue = isOverdue(r.waitingHours)
  return {
    label: formatWaiting(r.waitingHours),
    overdue,
    cls: overdue ? 'rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger' : 'text-text-muted',
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <ul v-if="groups.length" class="flex flex-col overflow-y-auto" data-test="kyc-queue">
      <li v-for="g in groups" :key="g.key" :data-test="`kyc-group-${g.key}`">
        <div class="flex items-center justify-between border-y border-border bg-bg/60 px-3.5 py-1.5">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">{{ g.title }}</span>
          <span class="rounded-full bg-surface-elevated px-2 text-xs font-semibold tabular-nums text-text-muted">{{ g.items.length }}</span>
        </div>
        <ul class="flex flex-col gap-0.5 p-1.5">
          <li v-for="r in g.items" :key="r.userId" :data-test="`kyc-row-${r.userId}`" :data-selected="selectedId === r.userId ? 'true' : undefined">
            <button
              type="button" :data-test="`open-${r.userId}`" :aria-current="selectedId === r.userId ? 'true' : undefined"
              :aria-label="`Ouvrir la vérification de ${kycDisplayName(r)}`"
              :class="['w-full rounded-btn border border-l-4 px-3 py-2.5 text-left transition-[background-color,border-color,scale] active:scale-[0.99]',
                BORDER[g.key],
                selectedId === r.userId ? 'border-y-primary border-r-primary bg-primary/5' : 'border-y-transparent border-r-transparent hover:bg-surface-elevated']"
              @click="emit('select', r.userId)"
            >
              <span class="flex items-baseline justify-between gap-2">
                <span :class="['min-w-0 truncate text-sm font-semibold', r.userName ? '' : 'italic text-text-muted']">{{ kycDisplayName(r) }}</span>
                <span v-if="waiting(r)" :class="['shrink-0 text-xs tabular-nums', waiting(r)!.cls]" :data-test="`kyc-waiting-${r.userId}`" :data-overdue="waiting(r)!.overdue ? 'true' : 'false'">{{ waiting(r)!.label }}</span>
              </span>
              <span v-if="r.userPhone" class="mt-0.5 block text-xs tabular-nums text-text-muted">{{ r.userPhone }}</span>
              <span class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span class="rounded-full bg-surface-elevated px-2 py-0.5 font-medium text-text-muted">{{ kycProviderLabel(r.provider) }}</span>
                <span :data-test="`kyc-status-${r.userId}`"><StatusBadge v-bind="kycStatusMeta(r.queueStatus ?? r.kycStatus)" /></span>
                <span v-if="r.decisionKind" :data-test="`kyc-decision-badge-${r.userId}`"><StatusBadge v-bind="kycDecisionMeta(r.decisionKind)" /></span>
              </span>
              <span v-if="r.rejectionCode" class="mt-1 block text-xs text-text-muted">{{ kycDecisionCodeLabel(r.rejectionCode) }}</span>
            </button>
          </li>
        </ul>
      </li>
    </ul>
    <StateBlock :loading="loading" :error="error" :empty="groups.length === 0" empty-label="Aucune vérification dans cette file" @retry="emit('retry')" />
  </div>
</template>
