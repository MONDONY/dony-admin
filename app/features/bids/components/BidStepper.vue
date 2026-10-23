<script setup lang="ts">
import { computed } from 'vue'
import type { AdminBidDetail } from '@/features/bids/types/index'
import { bidStepper, type BidStep } from '@/features/bids/lib/bidSteps'
import { formatDay } from '@/features/bids/lib/bidLabels'
import { formatInstant } from '@/features/user-profile/lib/formatInstant'
import { serverDateIso } from '@/lib/serverDate'

/** Frise d'étapes du colis (Créé → Livré), avec un bandeau pour les fins anticipées. */
const props = defineProps<{ bid: AdminBidDetail }>()
const model = computed(() => bidStepper(props.bid))

/** Jour calendaire tel quel ; instant du serveur (UTC sans fuseau) affiché à Paris. */
function dateOf(at: string | null | undefined): string | null {
  if (!at) return null
  return formatDay(at) ?? formatInstant(serverDateIso(at))
}
const STATE_LABEL: Record<BidStep['state'], string> = { done: 'faite', current: 'en cours', todo: 'à venir' }
const DOT: Record<BidStep['state'], string> = {
  done: 'bg-success text-white',
  current: 'bg-primary text-white ring-4 ring-primary/15',
  todo: 'border-2 border-border bg-surface text-text-muted',
}
</script>

<template>
  <div class="rounded-card bg-surface-elevated px-3 py-4">
    <ol class="grid grid-cols-6 gap-1" role="list" aria-label="Étapes du colis" data-test="bid-stepper">
      <li
        v-for="(s, i) in model.steps" :key="s.id" :data-test="`step-${s.id}`" :data-state="s.state"
        :aria-current="s.state === 'current' ? 'step' : undefined"
        class="flex min-w-0 flex-col items-center gap-1.5 text-center"
      >
        <span :class="['flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums', DOT[s.state]]" aria-hidden="true">
          <svg v-if="s.state === 'done'" viewBox="0 0 16 16" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span :class="['text-xs font-semibold text-balance', s.state === 'todo' ? 'text-text-muted' : '']">{{ s.label }}</span>
        <span class="sr-only">, étape {{ STATE_LABEL[s.state] }}</span>
        <span v-if="dateOf(s.at)" class="text-[11px] leading-tight text-text-muted tabular-nums">{{ dateOf(s.at) }}</span>
        <span v-else-if="s.state === 'current'" class="text-[11px] leading-tight text-primary">En cours</span>
      </li>
    </ol>
    <p
      v-if="model.ended" data-test="stepper-ended" :data-tone="model.ended.tone"
      :class="['mt-3 rounded-btn px-3 py-2 text-center text-sm font-medium',
               model.ended.tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-border/40 text-text-muted']"
    >{{ model.ended.label }}</p>
  </div>
</template>
