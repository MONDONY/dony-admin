<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import {
  formatMajorAmount,
  WALLET_REFUND_CHANNEL_LABELS,
  WALLET_REFUND_ORIGIN_LABELS,
  WALLET_REFUND_STATUS_LABELS,
} from '@/features/finance/types/index'
import type { AdminWalletRefundRequest } from '@/features/finance/types/index'
import { canRetryWalletRefund, failureLabel } from '@/features/finance/components/walletRefundRetry'

withDefaults(defineProps<{
  requests: AdminWalletRefundRequest[]
  loading: boolean
  busyId: string | null
  emptyLabel?: string
}>(), { emptyLabel: 'Aucune demande de remboursement en attente' })
const emit = defineEmits<{ resolve: [id: string]; retry: [id: string] }>()

function fmt(d: string) { return new Date(d).toLocaleDateString('fr-FR') }

/** Seul un ticket manuel en attente demande un geste : virement hors plateforme puis résolution. */
function needsAction(r: AdminWalletRefundRequest) {
  return r.status === 'PENDING' && (r.channel == null || r.channel === 'MANUAL_ADMIN')
}

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-warning/10 text-warning',
  PROCESSING: 'bg-primary/10 text-primary',
  FAILED: 'bg-danger/10 text-danger',
  REFUNDED: 'bg-success/10 text-success',
  RESOLVED: 'bg-success/10 text-success',
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Utilisateur</th>
            <th class="px-4 py-2 font-medium">Origine</th>
            <th class="px-4 py-2 font-medium">Canal</th>
            <th class="px-4 py-2 font-medium text-right">Montant</th>
            <th class="px-4 py-2 font-medium">Statut</th>
            <th class="px-4 py-2 font-medium">Demandé le</th>
            <th class="px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in requests" :key="r.id" :data-test="`wrr-row-${r.id}`" class="border-b border-border last:border-b-0">
            <td class="px-4 py-3 text-sm">
              <div class="font-medium" :data-test="`wrr-user-${r.id}`">{{ r.userName || 'Utilisateur' }}</div>
              <div class="text-xs text-text-muted tabular-nums" :title="r.userId">{{ r.userId.slice(0, 8) }}</div>
            </td>
            <td class="px-4 py-3 text-sm text-text-muted" :data-test="`wrr-origin-${r.id}`">
              {{ r.origin ? WALLET_REFUND_ORIGIN_LABELS[r.origin] : '—' }}
              <div v-if="r.parentRequestId" class="text-xs">Reprise d'un échec</div>
            </td>
            <td class="px-4 py-3 text-sm text-text-muted" :data-test="`wrr-channel-${r.id}`">{{ r.channel ? WALLET_REFUND_CHANNEL_LABELS[r.channel] : '—' }}</td>
            <td class="px-4 py-3 text-sm tabular-nums text-right">
              <div :data-test="`wrr-amount-${r.id}`">{{ formatMajorAmount(r.amount, r.currency) }}</div>
              <div v-if="r.paidAmount != null" class="text-xs text-text-muted" :data-test="`wrr-paid-${r.id}`">
                Versé : {{ formatMajorAmount(r.paidAmount, r.currency) }}
              </div>
              <div v-if="r.feeAmount" class="text-xs text-text-muted" :data-test="`wrr-fee-${r.id}`">
                Frais : {{ formatMajorAmount(r.feeAmount, r.currency) }}
              </div>
            </td>
            <td class="px-4 py-3 text-sm">
              <span :class="['inline-block rounded-full px-2 py-0.5 text-xs font-medium', STATUS_TONE[r.status] ?? 'bg-surface-elevated text-text-muted']">
                {{ WALLET_REFUND_STATUS_LABELS[r.status] ?? r.status }}
              </span>
              <div
                v-if="r.resolutionNote" class="mt-1 max-w-xs text-xs text-text-muted text-pretty break-words"
                :data-test="`wrr-note-${r.id}`"
              >Note : {{ r.resolutionNote }}</div>
              <div
                v-if="failureLabel(r.failureReason)" class="mt-1 max-w-xs text-xs text-text-muted text-pretty break-words"
                :data-test="`wrr-failure-${r.id}`"
              >Motif : {{ failureLabel(r.failureReason) }}</div>
            </td>
            <td class="px-4 py-3 text-sm text-text-muted tabular-nums">
              {{ fmt(r.requestedAt) }}
              <div v-if="r.resolvedAt" class="text-xs">Clos le {{ fmt(r.resolvedAt) }}</div>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex flex-wrap justify-end gap-2">
              <button
                v-if="canRetryWalletRefund(r)"
                type="button"
                :data-test="`wrr-retry-${r.id}`"
                :disabled="busyId === r.id"
                class="rounded-btn border border-primary px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                @click="emit('retry', r.id)"
              >Relancer le remboursement</button>
              <button
                v-if="needsAction(r)"
                type="button"
                :data-test="`wrr-resolve-${r.id}`"
                :disabled="busyId === r.id"
                class="rounded-btn bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                @click="emit('resolve', r.id)"
              >{{ busyId === r.id ? 'Traitement…' : 'Marquer remboursée' }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <StateBlock :loading="loading" :empty="requests.length === 0" :empty-label="emptyLabel" />
  </div>
</template>
