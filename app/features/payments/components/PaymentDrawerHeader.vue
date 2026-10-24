<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { paymentStatusMeta } from './paymentStatus'
import { paymentKindLabel, routeLabel } from '@/features/payments/lib/paymentLabels'
import { isPaymentHeld, paymentMethodLabel } from '@/features/payments/types/index'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import { parseServerDate } from '@/lib/serverDate'

/**
 * En-tête collant du tiroir paiement : n° de suivi copiable, trajet en titre, type, statut,
 * retenue, méthode et date de création ; menu « Actions » en slot. L'identifiant technique du
 * paiement descend dans l'onglet Références.
 */
const props = defineProps<{ payment: AdminPaymentDetail; copied: string | null }>()
const emit = defineEmits<{ copy: [key: string, value: string]; close: [] }>()

const title = computed(() => routeLabel(props.payment.insight) ?? 'Paiement')
const status = computed(() => paymentStatusMeta(props.payment.status))
const held = computed(() => isPaymentHeld(props.payment))
const created = computed(() => {
  const ms = parseServerDate(props.payment.createdAt)
  if (Number.isNaN(ms)) return null
  const d = new Date(ms)
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
})
const meta = computed(() => [paymentMethodLabel(props.payment.method), created.value ? `créé le ${created.value}` : null].filter(Boolean).join(' · '))
</script>

<template>
  <header class="sticky top-0 z-10 border-b border-border bg-surface px-4 pb-4 pt-5 sm:px-6">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div v-if="payment.trackingNumber" class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-sm font-semibold tracking-wide" data-test="payment-tracking">{{ payment.trackingNumber }}</span>
          <button
            type="button" data-test="payment-copy-tracking"
            class="inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
            @click="emit('copy', 'tracking', payment.trackingNumber)"
          >{{ copied === 'tracking' ? 'Copié' : 'Copier' }}</button>
        </div>
        <h2 id="payment-detail-title" class="font-display text-xl font-bold text-balance">{{ title }}</h2>
        <p class="mt-0.5 text-sm text-text-muted tabular-nums" data-test="payment-meta">{{ meta }}</p>
      </div>
      <div class="flex shrink-0 items-start gap-2">
        <div class="mt-2.5 flex flex-wrap justify-end gap-1">
          <StatusBadge
            v-if="payment.insight" data-test="payment-kind"
            :label="paymentKindLabel(payment.insight.kind)" :tone="payment.insight.kind === 'NEGOTIATION' ? 'warning' : 'neutral'"
          />
          <StatusBadge v-bind="status" data-test="payment-status" />
          <StatusBadge v-if="held" data-test="payment-held-badge" label="Versement retenu" tone="danger" />
        </div>
        <button
          type="button" data-test="payment-close-icon" aria-label="Fermer la fiche"
          class="inline-flex size-10 items-center justify-center rounded-btn text-text-muted transition-[background-color,transform] hover:bg-surface-elevated hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
          @click="emit('close')"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" class="size-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </div>
    <div v-if="$slots.actions" class="mt-3">
      <slot name="actions" />
    </div>
  </header>
</template>
