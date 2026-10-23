<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminBidDetail } from '@/features/bids/types/index'
import { bidStatusMeta, bidStatusPhrase } from './bidStatus'

/** En-tête collant du tiroir : n° de suivi, trajet, statut, phrase d'état et menu « Actions » (slot). */
const props = defineProps<{
  bid: AdminBidDetail
  title: string
  countries: string | null
  copied: string | null
}>()
const emit = defineEmits<{ copy: [value: string]; close: [] }>()

const status = computed(() => bidStatusMeta(props.bid.status))
const phrase = computed(() => bidStatusPhrase(props.bid.status))
</script>

<template>
  <header class="sticky top-0 z-10 border-b border-border bg-surface px-4 pb-4 pt-5 sm:px-6">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div v-if="bid.trackingNumber" class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-sm font-semibold tracking-wide" data-test="bid-tracking">{{ bid.trackingNumber }}</span>
          <button
            type="button" data-test="bid-copy-tracking"
            class="inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
            @click="emit('copy', bid.trackingNumber)"
          >{{ copied === 'tracking' ? 'Copié' : 'Copier' }}</button>
        </div>
        <p v-else class="text-sm text-text-muted" data-test="bid-tracking">N° de suivi pas encore attribué</p>
        <h2 id="bid-detail-title" class="font-display text-xl font-bold text-balance">{{ title }}</h2>
        <p v-if="countries" class="text-sm text-text-muted" data-test="bid-countries">{{ countries }}</p>
      </div>
      <div class="flex shrink-0 items-start gap-2">
        <StatusBadge v-bind="status" class="mt-2.5" data-test="bid-status" />
        <button
          type="button" data-test="bid-close-icon" aria-label="Fermer la fiche"
          class="inline-flex size-10 items-center justify-center rounded-btn text-text-muted transition-[background-color,transform] hover:bg-surface-elevated hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
          @click="emit('close')"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" class="size-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </div>
    <p v-if="phrase" class="mt-3 rounded-card bg-surface-elevated px-4 py-3 text-sm text-pretty" data-test="bid-phrase">{{ phrase }}</p>
    <p v-if="bid.refusalReason" class="mt-2 text-sm text-text-muted text-pretty" data-test="bid-refusal">Motif du refus : {{ bid.refusalReason }}</p>
    <div v-if="$slots.actions" class="mt-3">
      <slot name="actions" />
    </div>
  </header>
</template>
