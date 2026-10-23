<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BidAlertBadge from './BidAlertBadge.vue'
import { bidStatusMeta } from './bidStatus'
import { bidPaymentMethodLabel, formatDateTime, formatDay } from '@/features/bids/lib/bidLabels'
import { formatMajorAmount } from '@/features/finance/types/index'
import { useAuthStore } from '@/stores/auth'
import type { AdminBidListItem } from '@/features/bids/types/index'

withDefaults(defineProps<{ bids: AdminBidListItem[]; loading: boolean; error?: string | null; emptyLabel?: string; emptyHint?: string }>(), {
  error: null, emptyLabel: 'Aucun colis', emptyHint: undefined,
})
const emit = defineEmits<{ select: [id: string]; retry: [] }>()

const auth = useAuthStore()

function fmtCreated(d: string) {
  return new Date(d).toLocaleDateString('fr-FR')
}
const link = 'text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-border bg-surface">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Suivi</th>
          <th class="px-4 py-2 font-medium">Colis</th>
          <th class="px-4 py-2 font-medium">Trajet</th>
          <th class="px-4 py-2 font-medium">Personnes</th>
          <th class="px-4 py-2 font-medium">Net voyageur</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Mis à jour</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="b in bids"
          :key="b.id"
          :data-test="`bid-row-${b.id}`"
          class="cursor-pointer border-b border-border transition-colors hover:bg-surface-elevated"
          @click="emit('select', b.id)"
        >
          <td class="px-4 py-3 text-sm">
            <div class="font-mono text-xs" :data-test="`bid-tracking-${b.id}`">{{ b.trackingNumber ?? '—' }}</div>
            <div class="text-xs text-text-muted tabular-nums">Créé le {{ fmtCreated(b.createdAt) }}</div>
          </td>
          <td class="px-4 py-3 text-sm tabular-nums">
            <div :data-test="`bid-content-${b.id}`" class="max-w-[200px] truncate" :title="b.contentCategory ?? undefined">{{ b.contentCategory || '—' }}</div>
            <div class="text-xs text-text-muted">{{ b.weightKg }} kg</div>
          </td>
          <td class="px-4 py-3 text-sm">
            <div class="font-medium">{{ b.corridor }}</div>
            <div class="text-xs text-text-muted" :data-test="`bid-departure-${b.id}`">{{ formatDay(b.departureDate) ? `Départ ${formatDay(b.departureDate)}` : '—' }}</div>
          </td>
          <td class="px-4 py-3 text-sm">
            <div>
              <template v-if="b.senderId && auth.can('USER_VIEW')">
                <NuxtLink :to="`/users/${b.senderId}`" :class="link" @click.stop>{{ b.senderName ?? '—' }}</NuxtLink>
              </template>
              <template v-else>{{ b.senderName ?? '—' }}</template>
              <span class="text-text-muted"> → </span>
              <template v-if="b.travelerId && auth.can('USER_VIEW')">
                <NuxtLink :to="`/users/${b.travelerId}`" :class="link" @click.stop>{{ b.travelerName ?? '—' }}</NuxtLink>
              </template>
              <template v-else>{{ b.travelerName ?? '—' }}</template>
            </div>
            <div class="text-xs text-text-muted" :data-test="`bid-recipient-${b.id}`">{{ b.recipientName ? `Pour ${b.recipientName}` : '—' }}</div>
          </td>
          <td class="px-4 py-3 text-sm tabular-nums" :data-test="`bid-net-${b.id}`">
            <div>{{ b.netEur == null ? '—' : formatMajorAmount(b.netEur, b.currency) }}</div>
            <div class="text-xs text-text-muted">{{ bidPaymentMethodLabel(b.paymentMethod) }}</div>
          </td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap items-center gap-1">
              <StatusBadge v-bind="bidStatusMeta(b.status)" />
              <BidAlertBadge :code="b.alert" />
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums" :data-test="`bid-updated-${b.id}`">{{ formatDateTime(b.updatedAt) ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
    <StateBlock :loading="loading" :error="error" :empty="bids.length === 0" :empty-label="emptyLabel" :hint="emptyHint" @retry="emit('retry')" />
  </div>
</template>
