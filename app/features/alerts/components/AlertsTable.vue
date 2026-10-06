<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { alertSeverityMeta } from './alertSeverity'
import { alertGuide, alertSummary } from '@/features/alerts/lib/alertCatalog'
import { formatAlertDate } from '@/features/alerts/lib/alertDate'
import type { AdminAlert } from '@/features/alerts/types/index'
import { useAuthStore } from '@/stores/auth'
defineProps<{ alerts: AdminAlert[]; loading: boolean }>()
const emit = defineEmits<{ resolve: [id: string]; open: [alert: AdminAlert] }>()
const auth = useAuthStore()
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Alerte</th>
          <th class="px-4 py-2 font-medium">Sévérité</th>
          <th class="px-4 py-2 font-medium">Créée</th>
          <th class="px-4 py-2 font-medium">État</th>
          <th class="px-4 py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="a in alerts" :key="a.id" :data-test="`alert-row-${a.id}`"
          class="border-b border-border cursor-pointer hover:bg-surface-elevated/60"
          @click="emit('open', a)"
        >
          <td class="px-4 py-3 max-w-xl">
            <p class="text-sm font-medium">{{ alertGuide(a.type).title }}</p>
            <p class="text-xs text-text-muted line-clamp-2 text-pretty">{{ alertSummary(a) }}</p>
            <p class="text-[11px] text-text-muted font-mono mt-0.5">{{ a.type }}</p>
          </td>
          <td class="px-4 py-3"><StatusBadge v-bind="alertSeverityMeta(a.severity)" /></td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums whitespace-nowrap">{{ formatAlertDate(a.createdAt) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ a.resolved ? 'Résolue' : 'Ouverte' }}</td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <button
              type="button" :data-test="`details-${a.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-primary/15 text-primary hover:bg-primary/25"
              @click.stop="emit('open', a)"
            >Que faire ?</button>
            <button
              v-if="!a.resolved && auth.can('ALERT_RESOLVE')" type="button" :data-test="`resolve-${a.id}`"
              class="ml-2 rounded-btn px-3 py-1.5 text-sm bg-success/20 text-success hover:bg-success/30"
              @click.stop="emit('resolve', a.id)"
            >Résoudre</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="alerts.length === 0" class="p-6 text-center text-sm text-text-muted">Aucune alerte</p>
  </div>
</template>
