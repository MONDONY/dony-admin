<script setup lang="ts">
import { ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import GuaranteeFundForm from './GuaranteeFundForm.vue'
import SplitResolutionForm from './SplitResolutionForm.vue'
import { disputeStatusMeta } from './disputeStatus'
import { formatAmount } from '@/features/finance/types/index'
import type { AdminDisputeDetail, AdminDisputeSplitOptions, DisputeResolution } from '@/features/incidents/types/index'
import { useAuthStore } from '@/stores/auth'

withDefaults(defineProps<{ dispute: AdminDisputeDetail; open: boolean; splitOptions?: AdminDisputeSplitOptions | null }>(), { splitOptions: null })
const emit = defineEmits<{
  close: []; resolve: [resolution: DisputeResolution, note: string]; guarantee: [amountCents: number, beneficiaryUserId: string, reason: string]
  split: [senderRefund: number, travelerPayout: number, note: string]; 'retry-split': []
}>()

const auth = useAuthStore()
const pending = ref<DisputeResolution | null>(null)
/** Partager déplace de l'argent dans les deux sens : mêmes droits que la libération et le remboursement. */
const canSplit = () => auth.can('PAYMENT_RELEASE') && auth.can('PAYMENT_REFUND')
const splitStatusLabel: Record<string, string> = {
  CLAIMED: 'Décidé, rien encore exécuté chez Stripe',
  SENDER_REFUNDED: 'Expéditeur remboursé, versement voyageur à reprendre',
  COMPLETED: 'Exécuté',
}

function confirmResolve(note: string) {
  if (pending.value) emit('resolve', pending.value, note)
  pending.value = null
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <aside class="h-full w-full max-w-lg bg-surface border-l border-border overflow-y-auto p-6">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="font-display text-xl font-bold">{{ dispute.type }}</h2>
          <p class="text-sm text-text-muted">{{ dispute.senderName ?? '—' }} → {{ dispute.travelerName ?? '—' }}</p>
        </div>
        <StatusBadge v-bind="disputeStatusMeta(dispute.status)" />
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm mb-6">
        <div><dt class="text-text-muted">Bid</dt><dd>{{ dispute.bidId }}</dd></div>
        <div><dt class="text-text-muted">Devise du colis</dt><dd data-test="dispute-currency">{{ dispute.bidCurrency ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Remboursement gelé</dt><dd>{{ dispute.refundFrozen ? 'Oui' : 'Non' }}</dd></div>
        <div v-if="dispute.resolution"><dt class="text-text-muted">Résolution</dt><dd>{{ dispute.resolution }}</dd></div>
        <div v-if="dispute.guaranteeAmountCents != null">
          <dt class="text-text-muted">Fonds de garantie versé</dt>
          <dd class="tabular-nums" data-test="dispute-guarantee-paid">{{ formatAmount(dispute.guaranteeAmountCents, dispute.guaranteeCurrency ?? dispute.bidCurrency ?? '') }}</dd>
        </div>
      </dl>

      <section v-if="dispute.split" class="rounded-card border border-border p-4 mb-6 space-y-1 text-sm" data-test="split-result">
        <p class="font-semibold">Partage du séquestre</p>
        <p class="tabular-nums">Expéditeur : {{ dispute.split.senderRefundAmount }} {{ dispute.split.currency }} · Voyageur : {{ dispute.split.travelerPayoutAmount }} {{ dispute.split.currency }}</p>
        <p data-test="split-status">{{ splitStatusLabel[dispute.split.status] ?? dispute.split.status }}</p>
        <p v-if="dispute.split.lastError && dispute.split.status !== 'COMPLETED'" class="text-xs text-danger" data-test="split-error">
          {{ dispute.split.lastError }} ({{ dispute.split.attempts }} tentative(s))
        </p>
        <button
v-if="dispute.split.status !== 'COMPLETED' && auth.can('DISPUTE_RESOLVE') && canSplit()" type="button" data-test="split-retry"
          class="mt-2 rounded-btn px-3 py-2 text-sm bg-warning/20 text-warning hover:bg-warning/30" @click="emit('retry-split')">Reprendre le partage</button>
      </section>

      <template v-if="dispute.status === 'OPEN' && auth.can('DISPUTE_RESOLVE')">
        <div class="flex flex-wrap gap-2 mb-4">
          <button type="button" data-test="resolve-sender" class="rounded-btn px-3 py-2 text-sm bg-primary/15 text-primary" @click="pending = 'RESOLVED_FOR_SENDER'">Trancher pour l'expéditeur</button>
          <button type="button" data-test="resolve-traveler" class="rounded-btn px-3 py-2 text-sm bg-primary/15 text-primary" @click="pending = 'RESOLVED_FOR_TRAVELER'">Trancher pour le voyageur</button>
          <button type="button" data-test="resolve-dismiss" class="rounded-btn px-3 py-2 text-sm border border-border" @click="pending = 'DISMISSED'">Classer sans suite</button>
        </div>
        <SplitResolutionForm
          v-if="splitOptions && canSplit()"
          class="mb-4"
          :options="splitOptions"
          @submit="(s, t, n) => emit('split', s, t, n)"
        />
        <GuaranteeFundForm
          :currency="dispute.bidCurrency"
          :sender-id="dispute.senderId"
          :traveler-id="dispute.travelerId"
          :sender-name="dispute.senderName"
          :traveler-name="dispute.travelerName"
          @submit="(c, b, r) => emit('guarantee', c, b, r)"
        />
      </template>

      <button type="button" data-test="dispute-close" class="mt-6 rounded-btn px-4 py-2 text-sm border border-border" @click="emit('close')">Fermer</button>

      <ConfirmActionDialog
        :open="pending !== null"
        title="Résoudre le litige"
        message="Confirmer la résolution de ce litige."
        confirm-label="Confirmer"
        :require-reason="true"
        @confirm="confirmResolve"
        @cancel="pending = null"
      />
    </aside>
  </div>
</template>
