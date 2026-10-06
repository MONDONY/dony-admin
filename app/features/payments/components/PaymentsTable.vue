<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { paymentStatusMeta } from './paymentStatus'
import { formatMoney, isPaymentHeld, paymentMethodLabel } from '@/features/payments/types/index'
import type { AdminPaymentListItem } from '@/features/payments/types/index'
import { paymentKindLabel, routeLabel, shortId } from '@/features/payments/lib/paymentLabels'
import { parseServerDate } from '@/lib/serverDate'

defineProps<{ payments: AdminPaymentListItem[]; loading: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()

function fmt(d: string) {
  const ms = parseServerDate(d)
  return Number.isNaN(ms) ? '—' : new Date(ms).toLocaleDateString('fr-FR')
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-x-auto">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Paiement</th>
          <th class="px-4 py-2 font-medium">Expéditeur → Voyageur</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Méthode</th>
          <th class="px-4 py-2 font-medium">Montant</th>
          <th class="px-4 py-2 font-medium">Commission</th>
          <th class="px-4 py-2 font-medium">Créé</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id" :data-test="`payment-row-${p.id}`" class="border-b border-border hover:bg-surface-elevated cursor-pointer" @click="emit('select', p.id)">
          <td class="px-4 py-3">
            <div class="flex items-center gap-1.5">
              <StatusBadge :label="paymentKindLabel(p.insight?.kind)" :tone="p.insight?.kind === 'NEGOTIATION' ? 'warning' : 'neutral'" />
              <span class="text-sm font-medium">{{ routeLabel(p.insight) ?? '—' }}</span>
            </div>
            <p class="mt-0.5 font-mono text-[11px] text-text-muted" :title="p.id">
              {{ shortId(p.id) }}<span v-if="p.insight?.bidId ?? p.bidId"> · colis {{ shortId(p.insight?.bidId ?? p.bidId) }}</span>
            </p>
          </td>
          <td class="px-4 py-3 text-sm">
            <span :data-test="`payment-sender-${p.id}`">{{ p.insight?.sender?.name ?? '—' }}</span>
            <span class="text-text-muted"> → </span>
            <span>{{ p.insight?.traveler?.name ?? '—' }}</span>
          </td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap items-center gap-1">
              <StatusBadge v-bind="paymentStatusMeta(p.status)" />
              <StatusBadge v-if="isPaymentHeld(p)" :data-test="`payment-held-${p.id}`" label="Versement retenu" tone="danger" />
              <StatusBadge v-if="p.insight?.abandoned" :data-test="`payment-abandoned-${p.id}`" label="Checkout abandonné" tone="neutral" />
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ paymentMethodLabel(p.method) }}</td>
          <td class="px-4 py-3 text-sm tabular-nums whitespace-nowrap" :data-test="`payment-amount-${p.id}`">{{ formatMoney(p.amountCents, p.currency) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums whitespace-nowrap">{{ formatMoney(p.commissionCents, p.currency) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(p.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="payments.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun paiement</p>
  </div>
</template>
