<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { cashCommissionStatusMeta } from './cashCommissionStatus'
import { formatAmount } from '@/features/finance/types/index'
import type { AdminCashCommission, CashCommissionChargedVia } from '@/features/finance/types/index'

defineProps<{ commissions: AdminCashCommission[]; loading: boolean }>()

const chargedViaLabel: Record<CashCommissionChargedVia, string> = { WALLET: 'Portefeuille', CARD: 'Carte' }

function fmt(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr><th class="px-4 py-2 font-medium">Bid</th><th class="px-4 py-2 font-medium">Montant</th><th class="px-4 py-2 font-medium">Commission</th><th class="px-4 py-2 font-medium">Statut</th><th class="px-4 py-2 font-medium">Canal</th><th class="px-4 py-2 font-medium">Tentatives</th><th class="px-4 py-2 font-medium">Créé</th></tr>
      </thead>
      <tbody>
        <tr v-for="c in commissions" :key="c.bidId" :data-test="`cash-commission-row-${c.bidId}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-medium">{{ c.bidId }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ formatAmount(c.amountCents, c.currency) }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ formatAmount(c.commissionCents, c.currency) }}</td>
          <td class="px-4 py-3"><StatusBadge v-bind="cashCommissionStatusMeta(c.status)" /></td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ c.chargedVia ? chargedViaLabel[c.chargedVia] : '—' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ c.retryCount }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(c.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="commissions.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune commission cash</p>
  </div>
</template>
