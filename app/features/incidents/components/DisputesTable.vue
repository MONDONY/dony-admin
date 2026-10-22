<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { disputeStatusMeta } from './disputeStatus'
import type { AdminDisputeListItem } from '@/features/incidents/types/index'

defineProps<{ disputes: AdminDisputeListItem[]; loading: boolean; error?: string | null }>()
const emit = defineEmits<{ select: [id: string]; retry: [] }>()

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
    <StateBlock :loading="loading" :error="error" :empty="disputes.length === 0" empty-label="Aucun litige" @retry="emit('retry')" />
  </div>
</template>
