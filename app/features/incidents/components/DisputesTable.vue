<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { disputeStatusMeta } from './disputeStatus'
import type { AdminDisputeListItem } from '@/features/incidents/types/index'

defineProps<{ disputes: AdminDisputeListItem[]; loading: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()

function fmt(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr><th class="px-4 py-2 font-medium">Type</th><th class="px-4 py-2 font-medium">Expéditeur → Voyageur</th><th class="px-4 py-2 font-medium">Statut</th><th class="px-4 py-2 font-medium">Créé</th></tr>
      </thead>
      <tbody>
        <tr v-for="d in disputes" :key="d.id" :data-test="`dispute-row-${d.id}`" class="border-b border-border hover:bg-surface-elevated cursor-pointer" @click="emit('select', d.id)">
          <td class="px-4 py-3 text-sm font-medium">{{ d.type }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ d.senderName ?? '—' }} → {{ d.travelerName ?? '—' }}</td>
          <td class="px-4 py-3"><StatusBadge v-bind="disputeStatusMeta(d.status)" /></td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(d.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="disputes.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun litige</p>
  </div>
</template>
