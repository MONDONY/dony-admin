<script setup lang="ts">
import { computed } from 'vue'
import PaymentFlow from './PaymentFlow.vue'
import PaymentPartiesRow from './PaymentPartiesRow.vue'
import { bidStatusLabel, shortId } from '@/features/payments/lib/paymentLabels'
import { formatMoney } from '@/features/payments/types/index'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import { bidRoute, gate } from '@/lib/adminLinks'
import { useAuthStore } from '@/stores/auth'

/**
 * Onglet Résumé : parcours de l'argent, parties, montants en clair et colis lié. Le détail ligne à
 * ligne (remboursé, taux de change, dates) est dans l'onglet Argent.
 */
const props = defineProps<{ payment: AdminPaymentDetail }>()
const auth = useAuthStore()

const insight = computed(() => props.payment.insight ?? null)
const net = computed(() => insight.value?.netTravelerCents ?? props.payment.amountCents - props.payment.commissionCents)
/** Colis résolu par le back (négociation comprise), à défaut celui de la ligne. */
const bidId = computed(() => insight.value?.bidId ?? props.payment.bidId ?? null)
const bidLink = computed(() => gate(p => auth.can(p), 'BID_VIEW', bidRoute(bidId.value)))
const bidStatus = computed(() => bidStatusLabel(insight.value?.bidStatus))
const amounts = computed(() => [
  { key: 'amount', test: 'payment-detail-amount', label: 'Payé par l’expéditeur', cents: props.payment.amountCents, strong: false },
  { key: 'net', test: 'payment-detail-net', label: 'Net voyageur', cents: net.value, strong: true },
  { key: 'commission', test: 'payment-summary-commission', label: 'Commission Yadony', cents: props.payment.commissionCents, strong: false },
])
</script>

<template>
  <div class="flex flex-col gap-4">
    <PaymentFlow :payment="payment" />
    <PaymentPartiesRow :payment="payment" />

    <section class="rounded-card border border-border p-4" data-test="payment-summary-amounts" aria-labelledby="payment-summary-amounts-title">
      <h3 id="payment-summary-amounts-title" class="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">En clair</h3>
      <dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div v-for="a in amounts" :key="a.key">
          <dt class="text-sm text-text-muted">{{ a.label }}</dt>
          <dd :class="['font-display text-xl tabular-nums', a.strong ? 'font-bold' : 'font-semibold']" :data-test="a.test">{{ formatMoney(a.cents, payment.currency) }}</dd>
        </div>
      </dl>
      <p v-if="payment.refundedCents > 0" class="mt-3 text-sm text-text-muted tabular-nums" data-test="payment-summary-refunded">
        Remboursé : {{ formatMoney(payment.refundedCents, payment.currency) }}. Le détail ligne à ligne est dans l’onglet Argent.
      </p>
      <p v-else class="mt-3 text-sm text-text-muted">Rien remboursé pour l’instant. Le détail ligne à ligne est dans l’onglet Argent.</p>
    </section>

    <section class="rounded-card border border-border p-4" data-test="payment-linked-bid" aria-labelledby="payment-linked-bid-title">
      <h3 id="payment-linked-bid-title" class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Colis lié</h3>
      <div v-if="bidId" class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div class="min-w-0">
          <p class="font-medium" :title="bidId">Colis <span class="font-mono text-xs">{{ shortId(bidId) }}</span></p>
          <p v-if="bidStatus" class="text-text-muted">{{ bidStatus }}</p>
        </div>
        <NuxtLink
          v-if="bidLink" :to="bidLink" data-test="payment-bid-link" :title="bidId"
          class="inline-flex min-h-10 items-center rounded-btn bg-primary/10 px-3 text-sm font-medium text-primary transition-[background-color,transform] hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
        >Ouvrir le colis {{ shortId(bidId) }}</NuxtLink>
      </div>
      <p v-else class="text-sm text-text-muted">{{ insight?.kind === 'NEGOTIATION' ? 'Pas encore créé (négociation)' : 'Aucun colis lié' }}</p>
    </section>
  </div>
</template>
