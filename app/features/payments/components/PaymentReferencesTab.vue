<script setup lang="ts">
import { computed } from 'vue'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import { paymentLinks } from '@/features/payments/lib/paymentLinks'
import { transactionsViewRoute } from '@/lib/adminLinks'
import { useAuthStore } from '@/stores/auth'

/**
 * Onglet Références : identifiants techniques copiables (paiement, PaymentIntent, charge, opérations
 * pawaPay, fil de négociation), « Ouvrir dans Stripe », opérations mobile money, puis les raccourcis
 * vers le colis (fiche, suivi, incidents, échanges), le trajet et la demande de la négociation,
 * chacun derrière la permission de sa destination. Sans identifiant ni droit : pas de raccourci.
 */
const props = defineProps<{ payment: AdminPaymentDetail; copied: string | null }>()
const emit = defineEmits<{ copy: [key: string, value: string] }>()
const auth = useAuthStore()

const insight = computed(() => props.payment.insight ?? null)
const links = computed(() => paymentLinks(props.payment, p => auth.can(p)))
/** Fil de négociation : champ du détail (back #487), sinon celui du contexte. */
const threadId = computed(() => props.payment.negotiationThreadId ?? insight.value?.negotiationThreadId ?? null)
const mobileMoney = transactionsViewRoute({ tab: 'mobile-money' })

interface Ref { key: string; label: string; value: string }
/** Identifiants pawaPay : la dernière opération de chaque type. */
const pawapay = computed<Ref[]>(() => {
  if (props.payment.method !== 'PAWAPAY') return []
  const p = props.payment
  return [
    { key: 'deposit', label: 'Dépôt pawaPay', value: p.pawapayDepositId ?? '' },
    { key: 'payout', label: 'Versement pawaPay', value: p.pawapayPayoutId ?? '' },
    { key: 'refund', label: 'Remboursement pawaPay', value: p.pawapayRefundId ?? '' },
  ].filter(r => r.value)
})

const shortcuts = computed(() => [
  { key: 'ref-bid', label: 'Ouvrir le colis', to: links.value.bid },
  { key: 'ref-bid-tracking', label: 'Photos de remise et de livraison', to: links.value.bidTracking },
  { key: 'ref-bid-incidents', label: 'Incidents du colis', to: links.value.bidIncidents },
  { key: 'ref-bid-chat', label: 'Échanges des deux parties', to: links.value.bidChat },
  { key: 'trip', label: 'Voir le trajet', to: links.value.trip },
  { key: 'trip-bids', label: 'Autres colis du même trajet', to: links.value.tripBids },
].filter(s => s.to !== null))

const copyBtn = 'inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100'
const linkClass = 'inline-flex min-h-10 items-center rounded-btn px-2 text-sm font-medium text-primary underline-offset-2 transition-[background-color,transform] hover:bg-primary/10 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100'
</script>

<template>
  <div class="flex flex-col gap-5">
    <section data-test="payment-references" aria-labelledby="payment-references-title">
      <h3 id="payment-references-title" class="mb-2 text-sm font-semibold">Références</h3>
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
            <a
              v-if="insight?.stripeDashboardUrl" :href="insight.stripeDashboardUrl" target="_blank" rel="noopener noreferrer" data-test="payment-stripe-link"
              :class="linkClass"
            >Ouvrir dans Stripe <span aria-hidden="true">↗</span><span class="sr-only"> (nouvel onglet)</span></a>
          </dd>
        </div>
        <div v-if="insight?.stripeChargeId">
          <dt class="text-text-muted">Charge Stripe</dt>
          <dd class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-xs break-all">{{ insight.stripeChargeId }}</span>
            <button type="button" data-test="payment-copy-charge" :class="copyBtn" @click="emit('copy', 'charge', insight.stripeChargeId)">{{ copied === 'charge' ? 'Copié' : 'Copier' }}</button>
          </dd>
        </div>
        <div v-for="r in pawapay" :key="r.key" :data-test="`payment-pawapay-${r.key}`">
          <dt class="text-text-muted">{{ r.label }}</dt>
          <dd class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-xs break-all">{{ r.value }}</span>
            <button type="button" :data-test="`payment-copy-${r.key}`" :class="copyBtn" @click="emit('copy', r.key, r.value)">{{ copied === r.key ? 'Copié' : 'Copier' }}</button>
          </dd>
        </div>
        <div v-if="threadId || links.packageRequest" data-test="payment-thread">
          <dt class="text-text-muted">Fil de négociation</dt>
          <dd class="flex flex-wrap items-center gap-2">
            <template v-if="threadId">
              <span class="font-mono text-xs break-all">{{ threadId }}</span>
              <button type="button" data-test="payment-copy-thread" :class="copyBtn" @click="emit('copy', 'thread', threadId)">{{ copied === 'thread' ? 'Copié' : 'Copier' }}</button>
            </template>
            <NuxtLink v-if="links.packageRequest" :to="links.packageRequest" data-test="payment-package-request-link" :class="linkClass">Ouvrir la demande</NuxtLink>
          </dd>
        </div>
      </dl>
      <NuxtLink
        v-if="payment.method === 'PAWAPAY'" :to="mobileMoney" data-test="payment-mobile-money-link"
        :class="[linkClass, 'mt-2']"
      >Voir les opérations mobile money</NuxtLink>
    </section>

    <nav v-if="shortcuts.length" data-test="payment-shortcuts" aria-labelledby="payment-shortcuts-title">
      <h3 id="payment-shortcuts-title" class="mb-1 text-sm font-semibold">Colis et trajet</h3>
      <ul class="flex flex-wrap gap-x-4">
        <li v-for="s in shortcuts" :key="s.key">
          <NuxtLink :to="s.to!" :data-test="`payment-${s.key}-link`" :class="linkClass">{{ s.label }}</NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
