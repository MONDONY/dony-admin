<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { reportStatusMeta } from './reportStatus'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import type { AdminReport } from '@/features/signalements/types/index'
import { useAuthStore } from '@/stores/auth'
const props = withDefaults(defineProps<{
  reports: AdminReport[]
  loading: boolean
  /** Identifiants cochés ; la colonne de cases n'apparaît qu'avec REPORT_DELETE. */
  selected?: string[]
}>(), { selected: () => [] })
const emit = defineEmits<{
  resolve: [id: string]
  viewPhotos: [urls: string[]]
  toggle: [id: string]
  togglePage: []
  delete: [id: string]
}>()
const auth = useAuthStore()
const canDelete = computed(() => auth.can('REPORT_DELETE'))
const allChecked = computed(() => props.reports.length > 0 && props.reports.every((r) => props.selected.includes(r.id)))
const someChecked = computed(() => !allChecked.value && props.reports.some((r) => props.selected.includes(r.id)))
function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
/** Cible APP : ni libellé ni identifiant côté back, on nomme l’application. */
function targetLabel(r: AdminReport) {
  return r.targetLabel ?? r.targetId ?? (r.targetType === 'APP' ? 'Application' : '—')
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th v-if="canDelete" class="w-10 px-3 py-2">
            <input
              type="checkbox" data-test="select-page" aria-label="Sélectionner la page"
              :checked="allChecked" :indeterminate.prop="someChecked"
              :disabled="reports.length === 0"
              @change="emit('togglePage')"
            >
          </th>
          <th class="px-4 py-2 font-medium">Cible</th>
          <th class="px-4 py-2 font-medium">Motif</th>
          <th class="px-4 py-2 font-medium">Signalé par</th>
          <th class="px-4 py-2 font-medium">Créé</th>
          <th class="px-4 py-2 font-medium">État</th>
          <th class="px-4 py-2 font-medium"/>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in reports" :key="r.id" :data-test="`report-row-${r.id}`"
          :class="['border-b border-border', selected.includes(r.id) ? 'bg-primary/5' : '']"
        >
          <td v-if="canDelete" class="px-3 py-3">
            <input
              type="checkbox" :data-test="`select-${r.id}`" :aria-label="`Sélectionner le signalement`"
              :checked="selected.includes(r.id)"
              @change="emit('toggle', r.id)"
            >
          </td>
          <td class="px-4 py-3 text-sm">
            <div class="font-medium">{{ targetLabel(r) }}</div>
            <div class="text-xs text-text-muted">{{ r.targetType }}</div>
            <!-- Rapport du scarabée : la route de l’écran dit où regarder -->
            <div
              v-if="r.screenRoute" :data-test="`report-screen-${r.id}`"
              class="mt-1 inline-block rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text-muted"
            >Écran {{ r.screenRoute }}</div>
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
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <button
              v-if="r.status === 'OPEN' && auth.can('REPORT_RESOLVE')" type="button" :data-test="`resolve-${r.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-primary/15 text-primary hover:bg-primary/25"
              @click="emit('resolve', r.id)"
            >Traiter</button>
            <button
              v-if="canDelete" type="button" :data-test="`delete-${r.id}`" title="Supprimer"
              class="ml-1 rounded-btn px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
              @click="emit('delete', r.id)"
            >Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="reports.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun signalement</p>
  </div>
</template>
