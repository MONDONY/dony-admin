<script setup lang="ts">
import type { VolumeRow } from '@/features/overview/composables/useOverview'

defineProps<{ rows: VolumeRow[] }>()
</script>

<template>
  <div class="bg-surface border border-border rounded-card overflow-hidden">
    <p v-if="rows.length === 0" data-test="volumes-empty" class="p-6 text-center text-sm text-text-muted">
      Aucun paiement enregistré
    </p>
    <div v-else class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Devise</th>
            <th class="px-4 py-2 font-medium text-right">Escrow détenu</th>
            <th class="px-4 py-2 font-medium text-right">Libéré</th>
            <th class="px-4 py-2 font-medium text-right">Remboursé</th>
            <th class="px-4 py-2 font-medium text-right">Commission</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.currency" :data-test="`volume-row-${r.currency}`" class="border-t border-border">
            <td class="px-4 py-3 text-sm font-semibold">{{ r.currency }}</td>
            <td class="px-4 py-3 text-sm text-right tabular-nums" :data-test="`volume-escrow-${r.currency}`">{{ r.escrowHeld }}</td>
            <td class="px-4 py-3 text-sm text-right tabular-nums" :data-test="`volume-released-${r.currency}`">{{ r.released }}</td>
            <td class="px-4 py-3 text-sm text-right tabular-nums">{{ r.refunded }}</td>
            <td class="px-4 py-3 text-sm text-right tabular-nums" :data-test="`volume-commission-${r.currency}`">{{ r.commission }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
