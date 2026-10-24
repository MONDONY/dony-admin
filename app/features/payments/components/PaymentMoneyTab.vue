<script setup lang="ts">
import { computed } from 'vue'
import StripeResyncPanel from './StripeResyncPanel.vue'
import { parseServerDate } from '@/lib/serverDate'
import { formatMoney, paymentMethodLabel } from '@/features/payments/types/index'
import type { AdminPaymentDetail } from '@/features/payments/types/index'

/**
 * Onglet Argent : la section Montants de l'ancien panneau, telle quelle, et la resynchronisation
 * Stripe (paiement carte). Sa mise en forme définitive vient avec la tâche suivante.
 */
const props = defineProps<{ payment: AdminPaymentDetail }>()
const emit = defineEmits<{ resynced: [] }>()

const insight = computed(() => props.payment.insight ?? null)
/**
 * Encaissement carte : `capturedAt` du détail (back #487), sinon celui du contexte. Ni l'un ni
 * l'autre connus (ancien back sans contexte) : rien ne s'affiche, plutôt qu'un « Non encaissé » faux.
 */
const captureKnown = computed(() => props.payment.method === 'STRIPE' && (props.payment.capturedAt !== undefined || insight.value !== null))
const capturedAt = computed(() => props.payment.capturedAt ?? insight.value?.capturedAt ?? null)
const net = computed(() => insight.value?.netTravelerCents ?? props.payment.amountCents - props.payment.commissionCents)
function fmtDate(d: string | null | undefined) {
  const ms = parseServerDate(d)
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleString('fr-FR')
}
</script>

<template>
  <div>
    <section class="mb-5" data-test="payment-amounts">
      <h3 class="mb-2 text-sm font-semibold">Montants</h3>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div><dt class="text-text-muted">Payé par l’expéditeur</dt><dd class="tabular-nums" data-test="payment-detail-amount">{{ formatMoney(payment.amountCents, payment.currency) }}</dd></div>
        <div><dt class="text-text-muted">Commission Yadony</dt><dd class="tabular-nums">{{ formatMoney(payment.commissionCents, payment.currency) }}</dd></div>
        <div><dt class="text-text-muted">Net voyageur</dt><dd class="tabular-nums font-medium" data-test="payment-detail-net">{{ formatMoney(net, payment.currency) }}</dd></div>
        <div><dt class="text-text-muted">Remboursé</dt><dd class="tabular-nums">{{ formatMoney(payment.refundedCents, payment.currency) }}</dd></div>
        <div><dt class="text-text-muted">Méthode</dt><dd>{{ paymentMethodLabel(payment.method) }}</dd></div>
        <div v-if="insight?.fxExchangeRate"><dt class="text-text-muted">Taux de change</dt><dd class="tabular-nums">{{ insight.fxExchangeRate }}</dd></div>
        <div><dt class="text-text-muted">Créé le</dt><dd class="tabular-nums">{{ fmtDate(payment.createdAt) ?? '—' }}</dd></div>
        <div v-if="captureKnown" data-test="payment-captured">
          <dt class="text-text-muted">Encaissement carte</dt>
          <dd class="tabular-nums">{{ capturedAt && fmtDate(capturedAt) ? `Encaissé le ${fmtDate(capturedAt)}` : 'Non encaissé' }}</dd>
        </div>
        <div v-if="payment.escrowReleasedAt"><dt class="text-text-muted">Libéré le</dt><dd class="tabular-nums">{{ fmtDate(payment.escrowReleasedAt) }}</dd></div>
      </dl>
    </section>
    <section v-if="payment.method === 'STRIPE' && payment.stripePaymentIntentId" data-test="payment-resync">
      <StripeResyncPanel :payment-id="payment.id" :currency="payment.currency" @done="emit('resynced')" />
    </section>
  </div>
</template>
