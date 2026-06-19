<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { bidStatusMeta } from './bidStatus'
import type { AdminBidListItem } from '@/features/bids/types/index'

defineProps<{ bids: AdminBidListItem[]; loading: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()

function fmt(d: string) {
  return new Date(d).toLocaleDateString('fr-FR')
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Trajet</th>
          <th class="px-4 py-2 font-medium">Expéditeur → Voyageur</th>
          <th class="px-4 py-2 font-medium">Poids</th>
          <th class="px-4 py-2 font-medium">Net</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Créé</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="b in bids"
          :key="b.id"
          :data-test="`bid-row-${b.id}`"
          class="border-b border-border hover:bg-surface-elevated cursor-pointer"
          @click="emit('select', b.id)"
        >
          <td class="px-4 py-3 text-sm font-medium">{{ b.corridor }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ b.senderName ?? '—' }} → {{ b.travelerName ?? '—' }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ b.weightKg }} kg</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ b.netEur }} €</td>
          <td class="px-4 py-3"><StatusBadge v-bind="bidStatusMeta(b.status)" /></td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(b.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="bids.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun colis</p>
  </div>
</template>
