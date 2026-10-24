<script setup lang="ts">
import { computed } from 'vue'
import type { AdminPaymentDetail } from '@/features/payments/types/index'

/**
 * Onglet Références : la section Références de l'ancien panneau, telle quelle, plus l'identifiant
 * du paiement et le fil de négociation (descendus de l'en-tête et des parties).
 */
const props = defineProps<{ payment: AdminPaymentDetail; copied: string | null }>()
const emit = defineEmits<{ copy: [key: string, value: string] }>()

const insight = computed(() => props.payment.insight ?? null)
/** Fil de négociation : champ du détail (back #487), sinon celui du contexte. */
const threadId = computed(() => props.payment.negotiationThreadId ?? insight.value?.negotiationThreadId ?? null)
const copyBtn = 'inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100'
</script>

<template>
  <section data-test="payment-references">
    <h3 class="mb-2 text-sm font-semibold">Références</h3>
    <dl class="space-y-2 text-sm">
      <div data-test="payment-id">
        <dt class="text-text-muted">Paiement</dt>
        <dd class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-xs break-all">{{ payment.id }}</span>
          <button type="button" data-test="payment-copy-id" :class="copyBtn" @click="emit('copy', 'id', payment.id)">{{ copied === 'id' ? 'Copié' : 'Copier' }}</button>
        </dd>
      </div>
      <div v-if="payment.stripePaymentIntentId">
        <dt class="text-text-muted">{{ payment.method === 'PAWAPAY' ? 'Référence' : 'PaymentIntent Stripe' }}</dt>
        <dd class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-xs break-all">{{ payment.stripePaymentIntentId }}</span>
          <button type="button" data-test="payment-copy-pi" :class="copyBtn" @click="emit('copy', 'pi', payment.stripePaymentIntentId)">{{ copied === 'pi' ? 'Copié' : 'Copier' }}</button>
          <a v-if="insight?.stripeDashboardUrl" :href="insight.stripeDashboardUrl" target="_blank" rel="noopener noreferrer" data-test="payment-stripe-link" class="text-xs text-primary hover:underline">Ouvrir dans Stripe ↗</a>
        </dd>
      </div>
      <div v-if="insight?.stripeChargeId"><dt class="text-text-muted">Charge Stripe</dt><dd class="font-mono text-xs break-all">{{ insight.stripeChargeId }}</dd></div>
      <template v-if="payment.method === 'PAWAPAY'">
        <div v-if="payment.pawapayDepositId"><dt class="text-text-muted">Dépôt pawaPay</dt><dd class="font-mono text-xs break-all">{{ payment.pawapayDepositId }}</dd></div>
        <div v-if="payment.pawapayPayoutId"><dt class="text-text-muted">Versement pawaPay</dt><dd class="font-mono text-xs break-all">{{ payment.pawapayPayoutId }}</dd></div>
        <div v-if="payment.pawapayRefundId"><dt class="text-text-muted">Remboursement pawaPay</dt><dd class="font-mono text-xs break-all">{{ payment.pawapayRefundId }}</dd></div>
        <NuxtLink :to="{ path: '/transactions', query: { tab: 'mobile-money' } }" data-test="payment-mobile-money-link" class="inline-block text-xs text-primary hover:underline">Voir les opérations mobile money</NuxtLink>
      </template>
      <div v-if="threadId" data-test="payment-thread">
        <dt class="text-text-muted">Fil de négociation</dt>
        <dd class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-xs break-all">{{ threadId }}</span>
          <button type="button" data-test="payment-copy-thread" :class="copyBtn" @click="emit('copy', 'thread', threadId)">{{ copied === 'thread' ? 'Copié' : 'Copier' }}</button>
        </dd>
      </div>
    </dl>
  </section>
</template>
