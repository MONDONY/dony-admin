<script setup lang="ts">
import { formatMajorAmount, WALLET_REFUND_STATUS_LABELS } from '@/features/finance/types/index'
import type { AdminWalletRefundRequest } from '@/features/finance/types/index'

defineProps<{ requests: AdminWalletRefundRequest[]; loading: boolean; busyId: string | null }>()
const emit = defineEmits<{ resolve: [id: string] }>()

function fmt(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Utilisateur</th>
          <th class="px-4 py-2 font-medium">Montant</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Demandé le</th>
          <th class="px-4 py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in requests" :key="r.id" :data-test="`wrr-row-${r.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-medium">{{ r.userId }}</td>
          <td class="px-4 py-3 text-sm tabular-nums" :data-test="`wrr-amount-${r.id}`">{{ formatMajorAmount(r.amount, r.currency) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ WALLET_REFUND_STATUS_LABELS[r.status] ?? r.status }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(r.requestedAt) }}</td>
          <td class="px-4 py-3 text-right">
            <button
              v-if="r.status === 'PENDING'"
              type="button"
              :data-test="`wrr-resolve-${r.id}`"
              :disabled="busyId === r.id"
              class="rounded-btn bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              @click="emit('resolve', r.id)"
            >{{ busyId === r.id ? 'Traitement…' : 'Marquer remboursée' }}</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="requests.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune demande de remboursement en attente</p>
  </div>
</template>
