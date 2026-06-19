<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { reportStatusMeta } from './reportStatus'
import type { AdminReport } from '@/features/signalements/types/index'
defineProps<{ reports: AdminReport[]; loading: boolean }>()
const emit = defineEmits<{ resolve: [id: string] }>()
function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Cible</th>
          <th class="px-4 py-2 font-medium">Motif</th>
          <th class="px-4 py-2 font-medium">Signalé par</th>
          <th class="px-4 py-2 font-medium">Créé</th>
          <th class="px-4 py-2 font-medium">État</th>
          <th class="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in reports" :key="r.id" :data-test="`report-row-${r.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-medium">{{ r.targetType }}</td>
          <td class="px-4 py-3 text-sm">
            <div class="font-medium">{{ r.reason }}</div>
            <div v-if="r.description" class="text-xs text-text-muted">{{ r.description }}</div>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ r.reporterName ?? '—' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(r.createdAt) }}</td>
          <td class="px-4 py-3"><StatusBadge v-bind="reportStatusMeta(r.status)" /></td>
          <td class="px-4 py-3 text-right">
            <button
              v-if="r.status === 'OPEN'" type="button" :data-test="`resolve-${r.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-primary/15 text-primary hover:bg-primary/25"
              @click="emit('resolve', r.id)"
            >Traiter</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="reports.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun signalement</p>
  </div>
</template>
