<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { mobileMoneyStatusMeta } from './mobileMoneyStatus'
import { formatAmount, maskPhoneNumber } from '@/features/finance/types/index'
import type { AdminMobileMoneyPayment } from '@/features/finance/types/index'

defineProps<{ payments: AdminMobileMoneyPayment[]; loading: boolean }>()

const providerLabel: Record<string, string> = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' }

function fmt(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr><th class="px-4 py-2 font-medium">Bid</th><th class="px-4 py-2 font-medium">Opérateur</th><th class="px-4 py-2 font-medium">Téléphone</th><th class="px-4 py-2 font-medium">Montant</th><th class="px-4 py-2 font-medium">Statut</th><th class="px-4 py-2 font-medium">Créé</th></tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id" :data-test="`mm-row-${p.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-medium">{{ p.bidId }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ providerLabel[p.provider] ?? p.provider }}</td>
          <td class="px-4 py-3 text-sm tabular-nums" :data-test="`mm-phone-${p.id}`">{{ maskPhoneNumber(p.phoneNumber) }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ formatAmount(p.amountCents, p.currency) }}</td>
          <td class="px-4 py-3"><StatusBadge v-bind="mobileMoneyStatusMeta(p.status)" /></td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(p.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="payments.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun paiement mobile money</p>
  </div>
</template>
