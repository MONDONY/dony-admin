<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { reportStatusMeta } from './reportStatus'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import type { AdminReport } from '@/features/signalements/types/index'
import { useAuthStore } from '@/stores/auth'
defineProps<{ reports: AdminReport[]; loading: boolean }>()
const emit = defineEmits<{ resolve: [id: string]; viewPhotos: [urls: string[]] }>()
const auth = useAuthStore()
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
          <td class="px-4 py-3 text-sm">
            <div class="font-medium">{{ r.targetLabel ?? r.targetId }}</div>
            <div class="text-xs text-text-muted">{{ r.targetType }}</div>
          </td>
          <td class="px-4 py-3 text-sm">
            <div class="font-medium">{{ reportReasonLabel(r.reason) }}</div>
            <div v-if="r.description" class="text-xs text-text-muted">{{ r.description }}</div>
            <div v-if="r.photoUrls?.length" class="mt-1.5 flex gap-1.5">
              <button
                v-for="(url, i) in r.photoUrls" :key="i" type="button"
                :data-test="`report-photo-${r.id}-${i}`"
                class="h-10 w-10 overflow-hidden rounded border border-border hover:ring-2 hover:ring-primary"
                @click="emit('viewPhotos', r.photoUrls)"
              >
                <img :src="url" alt="Capture jointe" class="h-full w-full object-cover">
              </button>
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ r.reporterName ?? '—' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(r.createdAt) }}</td>
          <td class="px-4 py-3"><StatusBadge v-bind="reportStatusMeta(r.status)" /></td>
          <td class="px-4 py-3 text-right">
            <button
              v-if="r.status === 'OPEN' && auth.can('REPORT_RESOLVE')" type="button" :data-test="`resolve-${r.id}`"
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
