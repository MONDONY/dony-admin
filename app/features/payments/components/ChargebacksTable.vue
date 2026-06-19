<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatEuros } from '@/features/payments/types/index'
import type { AdminChargeback, ChargebackStatus } from '@/features/payments/types/index'

defineProps<{ chargebacks: AdminChargeback[]; loading: boolean }>()

const tone: Record<ChargebackStatus, 'warning' | 'success' | 'danger'> = {
  OPEN: 'warning',
  WON: 'success',
  LOST: 'danger'
}

function fmt(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr><th class="px-4 py-2 font-medium">Bid</th><th class="px-4 py-2 font-medium">Montant</th><th class="px-4 py-2 font-medium">Motif</th><th class="px-4 py-2 font-medium">Statut</th><th class="px-4 py-2 font-medium">Ouvert</th></tr>
      </thead>
      <tbody>
        <tr v-for="c in chargebacks" :key="c.id" :data-test="`cb-row-${c.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-medium">{{ c.bidId ?? '—' }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ formatEuros(c.amountCents) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ c.reason ?? '—' }}</td>
          <td class="px-4 py-3"><StatusBadge :label="c.status" :tone="tone[c.status]" /></td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(c.openedAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="chargebacks.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun litige bancaire</p>
  </div>
</template>
