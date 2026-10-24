<script setup lang="ts">
import { computed } from 'vue'
import StripeResyncPanel from './StripeResyncPanel.vue'
import { parseServerDate } from '@/lib/serverDate'
import { formatMoney, paymentMethodLabel } from '@/features/payments/types/index'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import { paymentLinks } from '@/features/payments/lib/paymentLinks'
import { useAuthStore } from '@/stores/auth'

/**
 * Onglet Argent : ligne à ligne payé → commission → net → remboursé, taux de change, encaissement
 * carte et libération ; lien vers la ventilation côté colis (BID_VIEW) ; resynchronisation Stripe
 * (paiement carte avec PaymentIntent).
 */
const props = defineProps<{ payment: AdminPaymentDetail }>()
const emit = defineEmits<{ resynced: [] }>()
const auth = useAuthStore()

const insight = computed(() => props.payment.insight ?? null)
const bidMoney = computed(() => paymentLinks(props.payment, p => auth.can(p)).bidMoney)
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
/** Les quatre montants, dans l'ordre où l'argent circule. */
const lines = computed(() => [
  { key: 'amount', label: 'Payé par l’expéditeur', cents: props.payment.amountCents, strong: false },
  { key: 'commission', label: 'Commission Yadony', cents: props.payment.commissionCents, strong: false },
  { key: 'net', label: 'Net voyageur', cents: net.value, strong: true },
  { key: 'refunded', label: 'Remboursé', cents: props.payment.refundedCents, strong: false },
])
</script>

<template>
  <div class="flex flex-col gap-5">
    <section data-test="payment-amounts" aria-labelledby="payment-amounts-title">
      <h3 id="payment-amounts-title" class="mb-2 text-sm font-semibold">Montants</h3>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div v-for="l in lines" :key="l.key">
          <dt class="text-text-muted">{{ l.label }}</dt>
          <dd :class="['tabular-nums', l.strong ? 'font-medium' : '']" :data-test="`payment-detail-${l.key}`">{{ formatMoney(l.cents, payment.currency) }}</dd>
        </div>
        <div><dt class="text-text-muted">Méthode</dt><dd>{{ paymentMethodLabel(payment.method) }}</dd></div>
        <div v-if="insight?.fxExchangeRate" data-test="payment-fx-rate"><dt class="text-text-muted">Taux de change</dt><dd class="tabular-nums">{{ insight.fxExchangeRate }}</dd></div>
        <div><dt class="text-text-muted">Créé le</dt><dd class="tabular-nums">{{ fmtDate(payment.createdAt) ?? '—' }}</dd></div>
        <div v-if="captureKnown" data-test="payment-captured">
          <dt class="text-text-muted">Encaissement carte</dt>
          <dd class="tabular-nums">{{ capturedAt && fmtDate(capturedAt) ? `Encaissé le ${fmtDate(capturedAt)}` : 'Non encaissé' }}</dd>
        </div>
        <div v-if="payment.escrowReleasedAt" data-test="payment-released-at"><dt class="text-text-muted">Libéré le</dt><dd class="tabular-nums">{{ fmtDate(payment.escrowReleasedAt) }}</dd></div>
      </dl>
      <NuxtLink
        v-if="bidMoney" :to="bidMoney" data-test="payment-bid-money-link"
        class="mt-3 inline-flex min-h-10 items-center rounded-btn px-2 text-sm font-medium text-primary underline-offset-2 transition-[background-color,transform] hover:bg-primary/10 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
      >Voir la ventilation côté colis</NuxtLink>
    </section>
    <section v-if="payment.method === 'STRIPE' && payment.stripePaymentIntentId" data-test="payment-resync">
      <StripeResyncPanel :payment-id="payment.id" :currency="payment.currency" @done="emit('resynced')" />
    </section>
  </div>
</template>
