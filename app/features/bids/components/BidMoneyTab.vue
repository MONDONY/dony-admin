<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import StripeResyncPanel from '@/features/payments/components/StripeResyncPanel.vue'
import { paymentStatusMeta } from '@/features/payments/components/paymentStatus'
import { formatMajorAmount } from '@/features/finance/types/index'
import { formatMoney } from '@/features/payments/types/index'
import type { PaymentStatus } from '@/features/payments/types/index'
import type { AdminBidDetail } from '@/features/bids/types/index'
import { bidPaymentMethodLabel, formatDateTime } from '@/features/bids/lib/bidLabels'
import { useAuthStore } from '@/stores/auth'
import { gate, paymentRoute, toHref } from '@/lib/adminLinks'

/** Onglet Argent : montants du paiement, versement, et resynchronisation Stripe. */
const props = defineProps<{ bid: AdminBidDetail }>()
const emit = defineEmits<{ /** Resynchronisation Stripe faite : la fiche est à relire. */ resynced: [] }>()
const auth = useAuthStore()

/** Ancien back (sans les champs de la fiche détaillée). */
const legacy = computed(() => props.bid.trip === undefined && props.bid.money === undefined && props.bid.links === undefined)
const money = computed(() => props.bid.money ?? null)
const isCash = computed(() => props.bid.paymentMethod === 'CASH')
const canSeePayments = computed(() => auth.can('PAYMENT_VIEW'))
const payStatus = computed(() => {
  const s = money.value?.status
  if (!s) return null
  return paymentStatusMeta(s as PaymentStatus) ?? { label: s, tone: 'neutral' as const }
})
const moneyEmpty = computed(() => {
  if (!canSeePayments.value) return 'Montants du paiement réservés aux admins qui consultent les transactions.'
  if (isCash.value) return 'Paiement en espèces à la remise : aucun paiement en ligne pour ce colis.'
  return 'Aucun paiement en ligne enregistré pour ce colis.'
})
const commissionRate = computed(() => (props.bid.commissionRate != null
  ? `${(props.bid.commissionRate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
  : null))
/** Versement retenu : la retenue se lit dans l'onglet Incidents du tiroir paiement (PAYMENT_VIEW). */
const heldHref = computed(() => {
  const m = money.value
  const route = m?.payoutHeldAt ? gate(auth.can, 'PAYMENT_VIEW', paymentRoute(m.paymentId, 'incidents')) : null
  return route ? toHref(route) : null
})
const canResync = computed(() => canSeePayments.value && money.value?.rail === 'STRIPE')
</script>

<template>
  <div>
    <section class="mb-6" data-test="section-money" aria-labelledby="bid-money-title">
      <h3 id="bid-money-title" class="mb-2 text-sm font-semibold">Argent</h3>
      <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <template v-if="money">
          <div><dt class="text-text-muted">Payé par l’expéditeur</dt><dd class="tabular-nums" data-test="money-amount">{{ formatMoney(money.amountCents, money.currency ?? undefined) }}</dd></div>
          <div><dt class="text-text-muted">Commission Yadony</dt><dd class="tabular-nums" data-test="money-commission">{{ formatMoney(money.commissionCents, money.currency ?? undefined) }}</dd></div>
        </template>
        <div><dt class="text-text-muted">Net voyageur</dt><dd class="tabular-nums font-medium" data-test="bid-detail-net">{{ formatMajorAmount(bid.netEur, bid.currency) }}</dd></div>
        <div><dt class="text-text-muted">Devise</dt><dd data-test="bid-detail-currency">{{ bid.currency ?? money?.currency ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Méthode</dt><dd data-test="money-method">{{ bidPaymentMethodLabel(bid.paymentMethod) }}</dd></div>
        <div v-if="!money && commissionRate"><dt class="text-text-muted">Taux de commission</dt><dd class="tabular-nums">{{ commissionRate }}</dd></div>
        <template v-if="money">
          <div><dt class="text-text-muted">Statut du paiement</dt><dd><StatusBadge v-if="payStatus" v-bind="payStatus" data-test="money-status" /><span v-else>—</span></dd></div>
          <div v-if="money.rail === 'STRIPE'" data-test="money-captured">
            <dt class="text-text-muted">Encaissé</dt>
            <dd class="tabular-nums">{{ money.capturedAt && formatDateTime(money.capturedAt) ? `Oui, le ${formatDateTime(money.capturedAt)}` : 'Non' }}</dd>
          </div>
          <div data-test="money-released">
            <dt class="text-text-muted">Versé au voyageur</dt>
            <dd class="tabular-nums">{{ money.escrowReleasedAt ? `Le ${formatDateTime(money.escrowReleasedAt)}` : 'Pas encore' }}</dd>
          </div>
          <div v-if="money.refundedCents > 0"><dt class="text-text-muted">Remboursé</dt><dd class="tabular-nums">{{ formatMoney(money.refundedCents, money.currency ?? undefined) }}</dd></div>
          <div v-if="money.payoutHeldAt" class="sm:col-span-2">
            <dt class="text-danger">Versement retenu</dt>
            <dd class="flex flex-wrap items-center gap-x-3 tabular-nums">
              <span>Depuis le {{ formatDateTime(money.payoutHeldAt) }}</span>
              <NuxtLink
                v-if="heldHref" :to="heldHref" data-test="money-held-link"
                class="inline-flex min-h-10 items-center rounded-btn px-2 font-medium text-primary transition-[background-color,transform] hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
              >Voir la retenue</NuxtLink>
            </dd>
          </div>
          <div v-if="money.disputed" class="sm:col-span-2"><dt class="text-danger">Litige bancaire</dt><dd>Ouvert chez la banque de l’expéditeur</dd></div>
        </template>
      </dl>
      <p v-if="!money" class="mt-2 text-sm text-text-muted text-pretty" data-test="money-empty">
        {{ legacy ? 'Détail du paiement non disponible pour l’instant.' : moneyEmpty }}
      </p>
    </section>
    <div v-if="canResync && money" class="mb-6" data-test="action-resync">
      <StripeResyncPanel :payment-id="money.paymentId" :currency="money.currency" @done="emit('resynced')" />
    </div>
  </div>
</template>
