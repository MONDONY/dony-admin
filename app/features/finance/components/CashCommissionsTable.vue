<script setup lang="ts">
import { computed } from 'vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { cashCommissionStatusMeta } from './cashCommissionStatus'
import { formatAmount } from '@/features/finance/types/index'
import type { AdminCashCommission, CashCommissionChargedVia } from '@/features/finance/types/index'
import { bidRoute, gate, userRoute } from '@/lib/adminLinks'
import { paymentAge, shortId } from '@/features/payments/lib/paymentLabels'
import { useAuthStore } from '@/stores/auth'

/**
 * Commissions cash, en lecture seule. Le colis (trajet, n° de suivi) mène à son onglet Argent
 * (BID_VIEW), le voyageur à sa fiche (USER_VIEW) ; un voyageur au compte supprimé reste un
 * identifiant abrégé en texte. Ancien back (aucun champ enrichi) : les colonnes d'avant.
 */
const props = withDefaults(defineProps<{ commissions: AdminCashCommission[]; loading: boolean; failed?: boolean; emptyLabel?: string }>(), {
  failed: false, emptyLabel: 'Aucune commission cash',
})

const auth = useAuthStore()
const can = (p: Parameters<typeof auth.can>[0]) => auth.can(p)
const ENRICHED = ['trackingNumber', 'corridor', 'travelerId', 'travelerName'] as const
const enriched = computed(() => props.commissions.some(c => ENRICHED.some(k => c[k] !== undefined)))
const bidLink = (c: AdminCashCommission) => gate(can, 'BID_VIEW', bidRoute(c.bidId, 'money'))
const travelerLink = (c: AdminCashCommission) => (c.travelerName ? gate(can, 'USER_VIEW', userRoute(c.travelerId)) : null)

const chargedViaLabel: Record<CashCommissionChargedVia, string> = { WALLET: 'Portefeuille', CARD: 'Carte' }
const link = 'rounded-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-x-auto">
    <table :class="['w-full', enriched ? 'min-w-[960px]' : 'min-w-[720px]']">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Colis</th>
          <th v-if="enriched" class="px-4 py-2 font-medium">Voyageur</th>
          <th class="px-4 py-2 font-medium text-right">Montant</th>
          <th class="px-4 py-2 font-medium text-right">Commission</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Canal</th>
          <th class="px-4 py-2 font-medium text-right">Tentatives</th>
          <th class="px-4 py-2 font-medium">Créé</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in commissions" :key="c.bidId" :data-test="`cash-commission-row-${c.bidId}`" class="border-b border-border last:border-b-0 align-top">
          <td class="px-4 py-3 text-sm">
            <template v-if="c.corridor || c.trackingNumber">
              <NuxtLink v-if="bidLink(c) && c.corridor" :to="bidLink(c)!" :data-test="`cash-route-${c.bidId}`" :class="[link, 'font-medium']">{{ c.corridor }}</NuxtLink>
              <span v-else-if="c.corridor" :data-test="`cash-route-${c.bidId}`" class="font-medium">{{ c.corridor }}</span>
              <div v-if="c.trackingNumber">
                <NuxtLink v-if="bidLink(c)" :to="bidLink(c)!" :data-test="`cash-tracking-${c.bidId}`" :class="[link, 'font-mono text-xs']">{{ c.trackingNumber }}</NuxtLink>
                <span v-else :data-test="`cash-tracking-${c.bidId}`" class="font-mono text-xs text-text-muted">{{ c.trackingNumber }}</span>
              </div>
            </template>
            <template v-else>
              <NuxtLink v-if="bidLink(c)" :to="bidLink(c)!" :data-test="`cash-bid-${c.bidId}`" :class="[link, 'tabular-nums']" :title="c.bidId">{{ shortId(c.bidId) }}</NuxtLink>
              <span v-else :data-test="`cash-bid-${c.bidId}`" class="tabular-nums" :title="c.bidId">{{ shortId(c.bidId) }}</span>
            </template>
          </td>
          <td v-if="enriched" class="px-4 py-3 text-sm">
            <NuxtLink v-if="travelerLink(c)" :to="travelerLink(c)!" :data-test="`cash-traveler-${c.bidId}`" :class="link">{{ c.travelerName }}</NuxtLink>
            <span v-else-if="c.travelerName" :data-test="`cash-traveler-${c.bidId}`">{{ c.travelerName }}</span>
            <span v-else-if="c.travelerId" :data-test="`cash-traveler-${c.bidId}`" class="tabular-nums text-text-muted" :title="c.travelerId">{{ shortId(c.travelerId) }}</span>
            <span v-else class="text-text-muted">—</span>
          </td>
          <td class="px-4 py-3 text-right text-sm tabular-nums whitespace-nowrap">{{ c.amountCents != null ? formatAmount(c.amountCents, c.currency) : '—' }}</td>
          <td class="px-4 py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap">{{ c.commissionCents != null ? formatAmount(c.commissionCents, c.currency) : '—' }}</td>
          <td class="px-4 py-3"><StatusBadge v-bind="cashCommissionStatusMeta(c.status)" /></td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ c.chargedVia ? chargedViaLabel[c.chargedVia] : '—' }}</td>
          <td class="px-4 py-3 text-right text-sm text-text-muted tabular-nums">{{ c.retryCount }}</td>
          <td class="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
            <template v-if="paymentAge(c.createdAt)">
              <div>{{ paymentAge(c.createdAt)!.day }}</div>
              <div class="text-xs text-text-muted">{{ paymentAge(c.createdAt)!.relative }}</div>
            </template>
            <span v-else class="text-text-muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
    <StateBlock :loading="loading" :empty="commissions.length === 0 && !failed" :empty-label="emptyLabel" />
  </div>
</template>
