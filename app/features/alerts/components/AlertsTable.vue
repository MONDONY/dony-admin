<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { alertSeverityMeta } from './alertSeverity'
import type { AdminAlert } from '@/features/alerts/types/index'
import { useAuthStore } from '@/stores/auth'
defineProps<{ alerts: AdminAlert[]; loading: boolean }>()
const emit = defineEmits<{ resolve: [id: string] }>()
const auth = useAuthStore()
function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Type</th>
          <th class="px-4 py-2 font-medium">Sévérité</th>
          <th class="px-4 py-2 font-medium">Créée</th>
          <th class="px-4 py-2 font-medium">État</th>
          <th class="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in alerts" :key="a.id" :data-test="`alert-row-${a.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-medium">{{ a.type }}</td>
          <td class="px-4 py-3"><StatusBadge v-bind="alertSeverityMeta(a.severity)" /></td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(a.createdAt) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ a.resolved ? 'Résolue' : 'Ouverte' }}</td>
          <td class="px-4 py-3 text-right">
            <button
              v-if="!a.resolved && auth.can('ALERT_RESOLVE')" type="button" :data-test="`resolve-${a.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-success/20 text-success hover:bg-success/30"
              @click="emit('resolve', a.id)"
            >Résoudre</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="alerts.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune alerte</p>
  </div>
</template>
