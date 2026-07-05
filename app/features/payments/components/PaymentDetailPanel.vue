<script setup lang="ts">
import { ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { paymentStatusMeta } from './paymentStatus'
import { formatEuros } from '@/features/payments/types/index'
import type { AdminPaymentDetail } from '@/features/payments/types/index'

defineProps<{ payment: AdminPaymentDetail; open: boolean; error?: string | null; busy?: boolean }>()
const emit = defineEmits<{ close: []; 'force-release': []; refund: [] }>()

const pending = ref<'release' | 'refund' | null>(null)

function confirm() {
  if (pending.value === 'release') emit('force-release')
  else if (pending.value === 'refund') emit('refund')
  pending.value = null
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <aside class="h-full w-full max-w-md bg-surface border-l border-border overflow-y-auto p-6">
      <div class="flex items-start justify-between mb-4">
        <h2 class="font-display text-xl font-bold">Paiement</h2>
        <StatusBadge v-bind="paymentStatusMeta(payment.status)" />
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm mb-6">
        <div><dt class="text-text-muted">Bid</dt><dd>{{ payment.bidId ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Méthode</dt><dd>{{ payment.method }}</dd></div>
        <div><dt class="text-text-muted">Montant</dt><dd class="tabular-nums">{{ formatEuros(payment.amountCents) }}</dd></div>
        <div><dt class="text-text-muted">Commission</dt><dd class="tabular-nums">{{ formatEuros(payment.commissionCents) }}</dd></div>
        <div><dt class="text-text-muted">Remboursé</dt><dd class="tabular-nums">{{ formatEuros(payment.refundedCents) }}</dd></div>
        <div><dt class="text-text-muted">Stripe PI</dt><dd class="truncate">{{ payment.stripePaymentIntentId ?? '—' }}</dd></div>
      </dl>
      <p v-if="error" data-test="payment-error" class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{{ error }}</p>
      <div v-if="payment.status === 'ESCROW'" class="flex flex-wrap gap-2">
        <button type="button" data-test="action-release" :disabled="busy" class="rounded-btn px-4 py-2 text-sm bg-success/20 text-success hover:bg-success/30 disabled:opacity-40" @click="pending = 'release'">{{ busy ? 'En cours…' : 'Débloquer (force-release)' }}</button>
        <button type="button" data-test="action-refund" :disabled="busy" class="rounded-btn px-4 py-2 text-sm bg-warning/20 text-warning hover:bg-warning/30 disabled:opacity-40" @click="pending = 'refund'">{{ busy ? 'En cours…' : 'Rembourser' }}</button>
      </div>
      <button type="button" data-test="payment-close" class="mt-6 rounded-btn px-4 py-2 text-sm border border-border" @click="emit('close')">Fermer</button>
      <ConfirmActionDialog
        :open="pending !== null"
        :title="pending === 'refund' ? 'Rembourser l\\\'expéditeur' : 'Débloquer le paiement'"
        :message="pending === 'refund' ? 'Le paiement sera remboursé.' : 'Le paiement sera libéré au voyageur.'"
        :confirm-label="pending === 'refund' ? 'Rembourser' : 'Débloquer'"
        :require-reason="true"
        @confirm="confirm"
        @cancel="pending = null"
      />
    </aside>
  </div>
</template>
