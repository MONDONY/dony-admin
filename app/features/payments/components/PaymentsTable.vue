<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { paymentStatusMeta } from './paymentStatus'
import { formatEuros } from '@/features/payments/types/index'
import type { AdminPaymentListItem } from '@/features/payments/types/index'

defineProps<{ payments: AdminPaymentListItem[]; loading: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()

function fmt(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr><th class="px-4 py-2 font-medium">Bid</th><th class="px-4 py-2 font-medium">Statut</th><th class="px-4 py-2 font-medium">Méthode</th><th class="px-4 py-2 font-medium">Montant</th><th class="px-4 py-2 font-medium">Commission</th><th class="px-4 py-2 font-medium">Créé</th></tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id" :data-test="`payment-row-${p.id}`" class="border-b border-border hover:bg-surface-elevated cursor-pointer" @click="emit('select', p.id)">
          <td class="px-4 py-3 text-sm font-medium">{{ p.bidId ?? '—' }}</td>
          <td class="px-4 py-3"><StatusBadge v-bind="paymentStatusMeta(p.status)" /></td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ p.method }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ formatEuros(p.amountCents) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ formatEuros(p.commissionCents) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(p.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="payments.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun paiement</p>
  </div>
</template>
