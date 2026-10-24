<script setup lang="ts">
import { computed } from 'vue'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import { paymentFlow, type PaymentFlowState } from '@/features/payments/lib/paymentFlow'
import { parseServerDate } from '@/lib/serverDate'

/** Parcours de l'argent en une ligne (Payé → Encaissé → Colis livré → Versé / Remboursé). */
const props = defineProps<{ payment: AdminPaymentDetail }>()
const model = computed(() => paymentFlow(props.payment))

function day(at: string | undefined): string | null {
  const ms = parseServerDate(at)
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
const STATE_LABEL: Record<PaymentFlowState, string> = { done: 'faite', current: 'en cours', todo: 'à venir', stop: 'bloquée' }
const DOT: Record<PaymentFlowState, string> = {
  done: 'bg-success text-white',
  current: 'bg-primary text-white ring-4 ring-primary/15',
  todo: 'border-2 border-border bg-surface text-text-muted',
  stop: 'bg-danger text-white ring-4 ring-danger/15',
}
</script>

<template>
  <section class="rounded-card bg-surface-elevated px-3 py-4" aria-labelledby="payment-flow-title">
    <h3 id="payment-flow-title" class="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Parcours de l’argent</h3>
    <ol class="grid grid-cols-4 gap-1" role="list" data-test="payment-flow">
      <li
        v-for="(s, i) in model.steps" :key="s.id" :data-test="`flow-step-${s.id}`" :data-state="s.state"
        :aria-current="s.state === 'current' ? 'step' : undefined"
        class="flex min-w-0 flex-col items-center gap-1.5 text-center"
      >
        <span :class="['flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums', DOT[s.state]]" aria-hidden="true">
          <svg v-if="s.state === 'done'" viewBox="0 0 16 16" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
          <template v-else-if="s.state === 'stop'">!</template>
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span :class="['text-xs font-semibold text-balance', s.state === 'todo' ? 'text-text-muted' : '', s.state === 'stop' ? 'text-danger' : '']">{{ s.label }}</span>
        <span class="sr-only">, étape {{ STATE_LABEL[s.state] }}</span>
        <span v-if="day(s.date)" class="text-[11px] leading-tight text-text-muted tabular-nums">{{ day(s.date) }}</span>
        <span v-else-if="s.state === 'current'" class="text-[11px] leading-tight text-primary">En cours</span>
      </li>
    </ol>
  </section>
</template>
