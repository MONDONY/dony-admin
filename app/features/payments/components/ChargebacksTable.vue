<script setup lang="ts">
import { computed, ref } from 'vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatMoney } from '@/features/payments/types/index'
import type { AdminChargeback } from '@/features/payments/types/index'
import { chargebackOutcomeLabel, chargebackReasonLabel } from '@/features/finance/lib/chargebackViews'
import { chargebackStatusMeta, paymentAge, shortId } from '@/features/payments/lib/paymentLabels'
import { bidRoute, gate, paymentRoute, userRoute, type AdminRoute } from '@/lib/adminLinks'
import { HIGHLIGHT_ROW_CLASS } from '@/lib/highlightRow'
import { useRowHighlight } from '@/composables/useRowHighlight'
import { useAuthStore } from '@/stores/auth'

/**
 * Litiges bancaires. Le colis (trajet, n° de suivi) mène à sa fiche (BID_VIEW), les personnes à
 * la leur (USER_VIEW), « Ouvrir le paiement » au tiroir paiement (PAYMENT_VIEW) ; une personne au
 * compte supprimé reste un identifiant abrégé en texte. La ligne ouverte par lien
 * (`highlightId`) est mise en évidence et amenée à l'écran. Ancien back : les colonnes d'avant.
 */
const props = withDefaults(defineProps<{
  chargebacks: AdminChargeback[]
  loading: boolean
  failed?: boolean
  emptyLabel?: string
  highlightId?: string | null
}>(), { failed: false, emptyLabel: 'Aucun litige bancaire', highlightId: null })

const auth = useAuthStore()
const can = (p: Parameters<typeof auth.can>[0]) => auth.can(p)
const ENRICHED = ['paymentId', 'trackingNumber', 'corridor', 'senderId', 'senderName', 'travelerId', 'travelerName'] as const
const enriched = computed(() => props.chargebacks.some(c => ENRICHED.some(k => c[k] !== undefined)))

interface Party { id: string | null | undefined; name: string | null | undefined; test: string }
const parties = (c: AdminChargeback): Party[] => [
  { id: c.senderId, name: c.senderName, test: 'sender' },
  { id: c.travelerId, name: c.travelerName, test: 'traveler' },
]
const personLink = (p: Party): AdminRoute | null => (p.name ? gate(can, 'USER_VIEW', userRoute(p.id)) : null)
const bidLink = (c: AdminChargeback) => gate(can, 'BID_VIEW', bidRoute(c.bidId))
const paymentLink = (c: AdminChargeback) => gate(can, 'PAYMENT_VIEW', paymentRoute(c.paymentId))

const root = ref<HTMLElement | null>(null)
useRowHighlight(root, () => props.highlightId, () => props.chargebacks)

const link = 'rounded-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
const action = 'inline-flex min-h-10 items-center rounded-btn px-1 text-xs font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
</script>

<template>
  <div ref="root" class="rounded-card border border-border bg-surface overflow-x-auto">
    <table :class="['w-full', enriched ? 'min-w-[960px]' : 'min-w-[640px]']">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Colis</th>
          <th v-if="enriched" class="px-4 py-2 font-medium">Expéditeur → Voyageur</th>
          <th class="px-4 py-2 font-medium text-right">Montant</th>
          <th class="px-4 py-2 font-medium">Motif</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Ouvert</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="c in chargebacks" :key="c.id" :data-test="`cb-row-${c.id}`" :data-row-id="c.id"
          :aria-current="highlightId === c.id ? 'true' : undefined"
          :class="['border-b border-border last:border-b-0 align-top transition-colors', highlightId === c.id && HIGHLIGHT_ROW_CLASS]"
        >
          <td class="px-4 py-3 text-sm">
            <template v-if="c.corridor || c.trackingNumber">
              <NuxtLink v-if="bidLink(c) && c.corridor" :to="bidLink(c)!" :data-test="`cb-route-${c.id}`" :class="[link, 'font-medium']">{{ c.corridor }}</NuxtLink>
              <span v-else-if="c.corridor" :data-test="`cb-route-${c.id}`" class="font-medium">{{ c.corridor }}</span>
              <div v-if="c.trackingNumber">
                <NuxtLink v-if="bidLink(c)" :to="bidLink(c)!" :data-test="`cb-tracking-${c.id}`" :class="[link, 'font-mono text-xs']">{{ c.trackingNumber }}</NuxtLink>
                <span v-else :data-test="`cb-tracking-${c.id}`" class="font-mono text-xs text-text-muted">{{ c.trackingNumber }}</span>
              </div>
            </template>
            <template v-else-if="c.bidId">
              <NuxtLink v-if="bidLink(c)" :to="bidLink(c)!" :data-test="`cb-bid-${c.id}`" :class="[link, 'tabular-nums']" :title="c.bidId">{{ shortId(c.bidId) }}</NuxtLink>
              <span v-else :data-test="`cb-bid-${c.id}`" class="tabular-nums" :title="c.bidId">{{ shortId(c.bidId) }}</span>
            </template>
            <span v-else class="text-text-muted">—</span>
          </td>
          <td v-if="enriched" class="px-4 py-3 text-sm" :data-test="`cb-parties-${c.id}`">
            <template v-if="parties(c).some(p => p.id || p.name)">
              <template v-for="(p, i) in parties(c)" :key="p.test">
                <span v-if="i === 1" class="px-1 text-text-muted" aria-hidden="true">→</span>
                <NuxtLink v-if="personLink(p)" :to="personLink(p)!" :data-test="`cb-${p.test}-${c.id}`" :class="link">{{ p.name }}</NuxtLink>
                <span v-else-if="p.name" :data-test="`cb-${p.test}-${c.id}`">{{ p.name }}</span>
                <span v-else-if="p.id" :data-test="`cb-${p.test}-${c.id}`" class="tabular-nums text-text-muted" :title="p.id">{{ shortId(p.id) }}</span>
                <span v-else class="text-text-muted">—</span>
              </template>
            </template>
            <span v-else class="text-text-muted">—</span>
          </td>
          <td class="px-4 py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap" :data-test="`cb-amount-${c.id}`">{{ formatMoney(c.amountCents, c.currency ?? undefined) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ chargebackReasonLabel(c.reason) ?? '—' }}</td>
          <td class="px-4 py-3 text-sm" :data-test="`cb-status-${c.id}`">
            <StatusBadge v-bind="chargebackStatusMeta(c.status)" />
            <div v-if="chargebackOutcomeLabel(c.status, c.outcome)" class="mt-1 text-xs text-text-muted">Issue : {{ chargebackOutcomeLabel(c.status, c.outcome) }}</div>
            <div v-if="c.resolvedAt && paymentAge(c.resolvedAt)" class="mt-1 text-xs text-text-muted tabular-nums">Tranché le {{ paymentAge(c.resolvedAt)!.day }}</div>
            <div v-if="paymentLink(c)">
              <NuxtLink :to="paymentLink(c)!" :data-test="`cb-payment-${c.id}`" :class="action">Ouvrir le paiement</NuxtLink>
            </div>
          </td>
          <td class="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
            <template v-if="paymentAge(c.openedAt)">
              <div>{{ paymentAge(c.openedAt)!.day }}</div>
              <div class="text-xs text-text-muted">{{ paymentAge(c.openedAt)!.relative }}</div>
            </template>
            <span v-else class="text-text-muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
    <StateBlock :loading="loading" :empty="chargebacks.length === 0 && !failed" :empty-label="emptyLabel" />
  </div>
</template>
