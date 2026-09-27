<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatMajorAmount } from '@/features/finance/types/index'
import { packageRequestStatusMeta } from '@/features/package-requests/labels'
import type { AdminPackageRequestListItem } from '@/features/package-requests/types/index'

defineProps<{ requests: AdminPackageRequestListItem[]; loading: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()

function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
function price(r: AdminPackageRequestListItem) {
  return r.targetPrice === null || r.targetPrice === undefined ? 'À négocier' : formatMajorAmount(r.targetPrice, r.currency)
}
function reportsLabel(n: number) { return `${n} signalement${n > 1 ? 's' : ''}` }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Trajet</th>
          <th class="px-4 py-2 font-medium">Expéditeur</th>
          <th class="px-4 py-2 font-medium">Date souhaitée</th>
          <th class="px-4 py-2 font-medium">Poids</th>
          <th class="px-4 py-2 font-medium">Budget</th>
          <th class="px-4 py-2 font-medium">Négos</th>
          <th class="px-4 py-2 font-medium">Statut</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in requests" :key="r.id" :data-test="`pr-row-${r.id}`"
          tabindex="0" role="button" :aria-label="`Ouvrir la demande ${r.departureCity} vers ${r.arrivalCity}`"
          class="border-b border-border cursor-pointer transition-colors hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none"
          @click="emit('select', r.id)" @keydown.enter="emit('select', r.id)"
        >
          <td class="px-4 py-3 text-sm">
            <div class="font-medium">{{ r.departureCity }} → {{ r.arrivalCity }}</div>
            <div class="text-xs text-text-muted tabular-nums">Créée le {{ fmtDate(r.createdAt) }}</div>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ r.senderName ?? 'Expéditeur inconnu' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ r.desiredDate ? fmtDate(r.desiredDate) : 'Date flexible' }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ r.weightKg !== null && r.weightKg !== undefined ? `${r.weightKg} kg` : 'Non renseigné' }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ price(r) }}</td>
          <td class="px-4 py-3 text-sm tabular-nums text-text-muted">{{ r.openNegotiationCount }}</td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap items-center gap-1.5">
              <StatusBadge v-bind="packageRequestStatusMeta(r.status)" />
              <span
                v-if="r.reportCount > 0" :data-test="`pr-reports-${r.id}`"
                class="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning tabular-nums"
              >{{ reportsLabel(r.reportCount) }}</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="requests.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune demande d’envoi</p>
  </div>
</template>
