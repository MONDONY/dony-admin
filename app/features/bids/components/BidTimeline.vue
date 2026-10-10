<script setup lang="ts">
import { computed } from 'vue'
import type { AdminBidTimeline, BidTimelineEntry } from '@/features/bids/types/index'
import { bidTimelineLabel, bidTimelineTone, formatDateTime } from '@/features/bids/lib/bidLabels'

/**
 * Chronologie du colis : scans, journal d'audit, paiement. `error` : chargement échoué (la fiche
 * reste lisible) ; liste vide : état explicite, jamais une section blanche.
 */
const props = defineProps<{ timeline: AdminBidTimeline | null; loading?: boolean; error?: string | null }>()

const entries = computed(() => props.timeline?.entries ?? [])

const DOT: Record<string, string> = {
  success: 'bg-success', danger: 'bg-danger', info: 'bg-primary', warning: 'bg-warning', neutral: 'bg-text-muted',
}
function dot(e: BidTimelineEntry) { return DOT[bidTimelineTone(e.kind, e.label)] }
function actor(e: BidTimelineEntry): string | null {
  if (e.actorKind === 'ADMIN') return e.actorLabel ? `par l’admin ${e.actorLabel}` : 'par un admin'
  if (e.actorLabel) return `par ${e.actorLabel}`
  if (e.source === 'AUDIT' || e.source === 'PAYMENT' || e.source === 'BID') return 'automatique'
  return null
}
function detail(e: BidTimelineEntry): string | null {
  if (!e.detail) return null
  // Les notations arrivent en « 5/5 » : en clair pour l'admin.
  return /^\d\/5$/.test(e.detail) ? `${e.detail.replace('/', ' sur ')} étoiles` : e.detail
}
</script>

<template>
  <div data-test="bid-timeline">
    <p v-if="loading" class="text-sm text-text-muted" data-test="timeline-loading">Chargement de la chronologie…</p>
    <p
      v-else-if="error" role="alert" data-test="timeline-error"
      class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
    >{{ error }}</p>
    <p
      v-else-if="entries.length === 0" data-test="timeline-empty"
      class="rounded-card bg-surface-elevated px-4 py-3 text-sm text-text-muted text-pretty"
    >Aucun évènement enregistré pour ce colis : ni scan, ni trace dans le journal, ni paiement.</p>
    <ol v-else class="relative space-y-3 border-l border-border pl-5">
      <li
        v-for="(e, i) in entries" :key="i" data-test="timeline-entry" :data-code="e.label"
        class="relative"
      >
        <span :class="['absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-2 border-surface', dot(e)]" />
        <p class="text-sm font-medium text-text text-pretty">{{ bidTimelineLabel(e.label) }}</p>
        <p class="text-xs text-text-muted tabular-nums">
          {{ formatDateTime(e.at) ?? '—' }}<span v-if="actor(e)" data-test="timeline-actor"> · {{ actor(e) }}</span>
        </p>
        <p v-if="detail(e)" class="text-xs text-text-muted break-words">{{ detail(e) }}</p>
        <p v-if="e.gpsLat != null && e.gpsLon != null" class="text-xs text-text-muted tabular-nums">GPS {{ e.gpsLat }}, {{ e.gpsLon }}</p>
        <a v-if="e.photoUrl" :href="e.photoUrl" target="_blank" rel="noopener noreferrer" class="mt-1 inline-block">
          <img
            :src="e.photoUrl" alt="Photo du scan"
            class="h-20 rounded-xs object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
          >
        </a>
      </li>
    </ol>
  </div>
</template>
