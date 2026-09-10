<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BidTimeline from './BidTimeline.vue'
import { bidStatusMeta } from './bidStatus'
import { formatMajorAmount } from '@/features/finance/types/index'
import { paymentMethodLabel } from '@/features/payments/types/index'
import type { AdminBidDetail, AdminBidTimeline } from '@/features/bids/types/index'

defineProps<{ bid: AdminBidDetail; timeline: AdminBidTimeline | null; open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <aside class="h-full w-full max-w-lg bg-surface border-l border-border overflow-y-auto p-6">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="font-display text-xl font-bold">{{ bid.corridor }}</h2>
          <p class="text-sm text-text-muted">{{ bid.senderName ?? '—' }} → {{ bid.travelerName ?? '—' }}</p>
        </div>
        <StatusBadge v-bind="bidStatusMeta(bid.status)" />
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm mb-6">
        <div><dt class="text-text-muted">Poids</dt><dd class="tabular-nums">{{ bid.weightKg }} kg</dd></div>
        <div><dt class="text-text-muted">Net</dt><dd class="tabular-nums" data-test="bid-detail-net">{{ formatMajorAmount(bid.netEur, bid.currency) }}</dd></div>
        <div><dt class="text-text-muted">Devise</dt><dd data-test="bid-detail-currency">{{ bid.currency ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Paiement</dt><dd>{{ paymentMethodLabel(bid.paymentMethod) }}</dd></div>
        <div><dt class="text-text-muted">Tracking</dt><dd>{{ bid.trackingNumber ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Contenu</dt><dd>{{ bid.contentCategory ?? '—' }}</dd></div>
      </dl>
      <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Timeline transaction</h3>
      <BidTimeline :timeline="timeline" />
      <button type="button" data-test="bid-close" class="mt-6 rounded-btn px-4 py-2 text-sm border border-border" @click="emit('close')">Fermer</button>
    </aside>
  </div>
</template>
