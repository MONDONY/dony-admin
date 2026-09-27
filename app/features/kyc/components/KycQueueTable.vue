<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  formatWaiting, isOverdue, kycDecisionCodeLabel, kycDecisionMeta, kycProviderLabel, kycStatusMeta,
} from '@/features/kyc/types/index'
import type { AdminKycQueueItem } from '@/features/kyc/types/index'

defineProps<{ items: AdminKycQueueItem[]; loading: boolean }>()
const emit = defineEmits<{ select: [userId: string] }>()

function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleString('fr-FR') : 'Date inconnue' }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-x-auto">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Utilisateur</th>
          <th class="px-4 py-2 font-medium">Fournisseur</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Soumise le</th>
          <th class="px-4 py-2 font-medium">Attente</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in items" :key="r.userId" :data-test="`kyc-row-${r.userId}`"
          tabindex="0" role="button" :aria-label="`Ouvrir la vérification de ${r.userName ?? r.userId}`"
          class="border-b border-border cursor-pointer transition-colors hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none"
          @click="emit('select', r.userId)" @keydown.enter="emit('select', r.userId)"
        >
          <td class="px-4 py-3 text-sm">
            <div class="font-medium" :class="r.userName ? '' : 'text-text-muted italic'">{{ r.userName ?? 'Nom non renseigné' }}</div>
            <div v-if="r.userPhone" class="text-xs text-text-muted tabular-nums">{{ r.userPhone }}</div>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ kycProviderLabel(r.provider) }}</td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap items-center gap-1.5">
              <span :data-test="`kyc-status-${r.userId}`"><StatusBadge v-bind="kycStatusMeta(r.queueStatus ?? r.kycStatus)" /></span>
              <span v-if="r.decisionKind" :data-test="`kyc-decision-badge-${r.userId}`">
                <StatusBadge v-bind="kycDecisionMeta(r.decisionKind)" />
              </span>
            </div>
            <div v-if="r.rejectionCode" class="mt-1 text-xs text-text-muted">{{ kycDecisionCodeLabel(r.rejectionCode) }}</div>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmtDate(r.submittedAt) }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">
            <span
              :data-test="`kyc-waiting-${r.userId}`" :data-overdue="isOverdue(r.waitingHours) ? 'true' : 'false'"
              :class="isOverdue(r.waitingHours) ? 'font-semibold text-danger' : 'text-text-muted'"
            >{{ r.waitingHours === null || r.waitingHours === undefined ? 'Sans objet' : formatWaiting(r.waitingHours) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="items.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune vérification dans cette file</p>
  </div>
</template>
