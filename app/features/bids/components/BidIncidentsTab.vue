<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminBidDetail } from '@/features/bids/types/index'
import { disputeStatusLabel } from '@/features/bids/lib/bidLabels'
import { cancellationReasonLabel, disputeTypeLabel, scopeLabel } from '@/features/user-profile/lib/sectionColumns'
import { formatInstant } from '@/features/user-profile/lib/formatInstant'
import { noShowStatusMeta } from '@/features/incidents/components/noShowLabels'
import type { NoShowStatus } from '@/features/incidents/types/index'
import { parseServerDate } from '@/lib/serverDate'
import { useAuthStore } from '@/stores/auth'

/** Onglet Incidents : litiges et absences du colis, avec un lien vers leur file de traitement. */
const props = defineProps<{ bid: AdminBidDetail }>()
const auth = useAuthStore()

const disputes = computed(() => props.bid.incidents?.disputes ?? [])
const cancellations = computed(() => props.bid.incidents?.cancellations ?? [])
const canOpen = computed(() => auth.can('DISPUTE_VIEW'))

const date = (at: string | null) => {
  const ms = parseServerDate(at)
  return Number.isNaN(ms) ? '—' : formatInstant(new Date(ms).toISOString())
}
/** État d'une absence : libellé connu, sinon le code brut en neutre (`noShowStatusMeta`). */
const noShow = (s: string | null) => (s ? noShowStatusMeta(s as NoShowStatus) : null)
const linkClass = 'inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
</script>

<template>
  <div class="flex flex-col gap-3" data-test="bid-incidents-tab">
    <p
      v-if="disputes.length === 0 && cancellations.length === 0" data-test="incidents-empty"
      class="rounded-card bg-surface-elevated px-4 py-3 text-sm text-text-muted text-pretty"
    >Aucun incident sur ce colis.</p>

    <article
      v-for="d in disputes" :key="d.id" data-test="incident-dispute"
      class="rounded-card border border-border bg-surface p-4"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="text-sm font-semibold text-balance">{{ disputeTypeLabel(d.type) }}</h3>
        <span class="text-xs text-text-muted">Litige : {{ disputeStatusLabel(d.status) || '—' }}</span>
      </div>
      <dl class="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div><dt class="text-text-muted">Ouvert le</dt><dd class="tabular-nums">{{ date(d.createdAt) }}</dd></div>
        <div v-if="d.resolvedAt"><dt class="text-text-muted">Résolu le</dt><dd class="tabular-nums">{{ date(d.resolvedAt) }}</dd></div>
        <div v-if="d.resolutionType" class="sm:col-span-2"><dt class="text-text-muted">Résolution</dt><dd class="break-words">{{ d.resolutionType }}</dd></div>
      </dl>
      <NuxtLink v-if="canOpen" :to="`/incidents?open=${d.id}`" :class="linkClass" :data-test="`incident-dispute-link-${d.id}`">Ouvrir le litige</NuxtLink>
    </article>

    <article
      v-for="c in cancellations" :key="c.id" data-test="incident-cancellation"
      class="rounded-card border border-border bg-surface p-4"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="text-sm font-semibold text-balance">Absence : {{ scopeLabel(c.scope) }}</h3>
        <StatusBadge v-if="noShow(c.noShowStatus)" v-bind="noShow(c.noShowStatus)!" />
      </div>
      <dl class="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div class="sm:col-span-2"><dt class="text-text-muted">Motif</dt><dd class="break-words">{{ cancellationReasonLabel(c.reason) }}</dd></div>
        <div><dt class="text-text-muted">Signalée le</dt><dd class="tabular-nums">{{ date(c.createdAt) }}</dd></div>
      </dl>
      <NuxtLink v-if="canOpen" :to="`/incidents?tab=noshows&open=${c.id}`" :class="linkClass" :data-test="`incident-noshow-link-${c.id}`">Ouvrir l’absence</NuxtLink>
    </article>
  </div>
</template>
