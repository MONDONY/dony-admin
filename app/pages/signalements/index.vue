<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ReportsTable from '@/features/signalements/components/ReportsTable.vue'
import RatingsTable from '@/features/signalements/components/RatingsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useReports } from '@/features/signalements/composables/useReports'
import { useRatings } from '@/features/signalements/composables/useRatings'
import { useAuthStore } from '@/stores/auth'
import { actionsFor } from '@/features/signalements/reportActions'
import { REPORT_ACTION_LABELS, REPORT_TARGET_TYPE_LABELS } from '@/features/signalements/reportActionLabels'
import type { ReportAction, ReportStatusFilter, ReportTargetType } from '@/features/signalements/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'REPORT_VIEW', pageTitle: 'Signalements & avis', pageSubtitle: 'Modération des signalements et des avis' })

// L'onglet Avis interroge /admin/ratings, protégé par RATING_MODERATE — une permission
// distincte de celle de la page (REPORT_VIEW). Un compte dont RATING_MODERATE a été révoqué
// par override verrait sinon un onglet qui répond 403 en affichant « aucun avis ».
const auth = useAuthStore()
const activeTab = ref<'reports' | 'ratings'>('reports')

// ---- Signalements ----
const r = useReports()
const reportStatusTabs: { value: ReportStatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'Ouverts' },
  { value: 'RESOLVED', label: 'Résolus' },
  { value: 'DISMISSED', label: 'Rejetés' },
  { value: 'ALL', label: 'Tous' },
]
const targetTypeFilters: { value: ReportTargetType | null; label: string }[] = [
  { value: null, label: 'Tous les types' },
  ...(Object.entries(REPORT_TARGET_TYPE_LABELS) as [ReportTargetType, string][])
    .map(([value, label]) => ({ value, label })),
]
const pendingReportId = ref<string | null>(null)
const chosenAction = ref<ReportAction>('DISMISS')
const resolveNote = ref('')
const viewerUrls = ref<string[] | null>(null)

// Le signalement en cours de traitement — sert à filtrer les actions proposées
// (SUSPEND_TARGET n'a de sens que sur USER, REMOVE_CONTENT que sur ANNOUNCEMENT ;
// le back les rejette de toute façon, mais autant ne pas les proposer).
const pendingReport = computed(() => r.reports.value.find((x) => x.id === pendingReportId.value) ?? null)
const availableActions = computed<{ value: ReportAction; label: string }[]>(() => {
  const targetType = pendingReport.value?.targetType ?? 'APP'
  return actionsFor(targetType, auth.permissions).map((value) => ({ value, label: REPORT_ACTION_LABELS[value] }))
})

function onTargetTypeFilterChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  r.setTargetTypeFilter(value === '' ? null : (value as ReportTargetType))
}

function openResolve(id: string) {
  pendingReportId.value = id
  // DISMISS s'applique toujours, quel que soit le type de cible — les actions
  // délèguées (WARN/SUSPEND_TARGET/REMOVE_CONTENT) ne sont pas toutes valides
  // pour tous les types, donc jamais choisies par défaut.
  chosenAction.value = 'DISMISS'
  resolveNote.value = ''
}
async function confirmResolve() {
  if (pendingReportId.value && resolveNote.value.trim()) {
    await r.resolve(pendingReportId.value, chosenAction.value, resolveNote.value.trim())
    pendingReportId.value = null
  }
}

// ---- Avis ----
const rt = useRatings()
const pendingExcludeId = ref<string | null>(null)
const pendingRemoveId = ref<string | null>(null)

async function confirmExclude(reason: string) {
  if (pendingExcludeId.value) await rt.exclude(pendingExcludeId.value, true, reason)
  pendingExcludeId.value = null
}
async function confirmRemove(reason: string) {
  if (pendingRemoveId.value) await rt.remove(pendingRemoveId.value)
  void reason
  pendingRemoveId.value = null
}

function switchTab(t: 'reports' | 'ratings') {
  activeTab.value = t
  if (t === 'ratings' && rt.ratings.value.length === 0) rt.fetchRatings()
}

onMounted(r.fetchReports)
</script>

<template>
  <div>
    <!-- Onglets principaux -->
    <div class="flex gap-1 mb-4 border-b border-border">
      <button
        type="button" data-test="tab-reports"
        :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          activeTab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text']"
        @click="switchTab('reports')"
      >Signalements</button>
      <button
        v-if="auth.can('RATING_MODERATE')" type="button" data-test="tab-ratings"
        :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          activeTab === 'ratings' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text']"
        @click="switchTab('ratings')"
      >Avis</button>
    </div>

    <!-- SIGNALEMENTS -->
    <div v-show="activeTab === 'reports'">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex gap-1">
          <button
            v-for="t in reportStatusTabs" :key="t.value" type="button" :data-test="`report-tab-${t.value}`"
            :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
              r.filters.status === t.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
            @click="r.setStatusFilter(t.value)"
          >{{ t.label }}</button>
        </div>
        <select
          data-test="report-target-type-filter"
          :value="r.filters.targetType ?? ''"
          class="rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted"
          @change="onTargetTypeFilterChange"
        >
          <option v-for="t in targetTypeFilters" :key="t.value ?? 'all'" :value="t.value ?? ''">{{ t.label }}</option>
        </select>
      </div>

      <p v-if="r.error.value" data-test="reports-error" class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{{ r.error.value }}</p>

      <ReportsTable :reports="r.reports.value" :loading="r.isLoading.value" @resolve="openResolve" @view-photos="(urls) => viewerUrls = urls" />

      <div class="mt-4">
        <PaginationControls :page="r.currentPage.value" :total-pages="r.totalPages.value" @change="r.goToPage" />
      </div>
    </div>

    <!-- AVIS -->
    <div v-show="activeTab === 'ratings' && auth.can('RATING_MODERATE')">
      <label class="flex items-center gap-2 mb-4 text-sm text-text-muted cursor-pointer">
        <input
          type="checkbox" data-test="flagged-only"
          :checked="rt.filters.flaggedOnly"
          @change="rt.setFlaggedOnly(($event.target as HTMLInputElement).checked)"
        >
        Signalés uniquement
      </label>

      <RatingsTable
        :ratings="rt.ratings.value" :loading="rt.isLoading.value"
        @exclude="(id) => pendingExcludeId = id" @remove="(id) => pendingRemoveId = id"
      />

      <div class="mt-4">
        <PaginationControls :page="rt.currentPage.value" :total-pages="rt.totalPages.value" @change="rt.goToPage" />
      </div>
    </div>

    <!-- Visionneuse des captures d'écran jointes -->
    <div
      v-if="viewerUrls !== null"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" data-test="photo-viewer"
      @click.self="viewerUrls = null"
    >
      <div class="max-h-full max-w-4xl overflow-auto rounded-card bg-surface p-4 shadow-xl">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-display text-lg font-semibold">Captures jointes</h2>
          <button
            type="button" data-test="photo-viewer-close"
            class="rounded-btn px-3 py-1.5 text-sm border border-border hover:bg-surface-elevated"
            @click="viewerUrls = null"
          >Fermer</button>
        </div>
        <div class="flex flex-wrap gap-4">
          <img
            v-for="(url, i) in viewerUrls" :key="i" :src="url" alt="Capture d'écran jointe"
            class="max-h-[70vh] max-w-full rounded border border-border object-contain"
          >
        </div>
      </div>
    </div>

    <!-- Dialogue de résolution d'un signalement (action + note) -->
    <div
      v-if="pendingReportId !== null"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-test="resolve-overlay"
    >
      <div class="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-xl">
        <h2 class="font-display text-lg font-semibold mb-1">Traiter le signalement</h2>
        <p class="text-sm text-text-muted mb-4">Choisis l'action et documente la décision.</p>
        <select
          v-model="chosenAction" data-test="resolve-action"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm mb-3"
        >
          <option v-for="a in availableActions" :key="a.value" :value="a.value">{{ a.label }}</option>
        </select>
        <textarea
          v-model="resolveNote" data-test="resolve-note" rows="3"
          placeholder="Motif (obligatoire)"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm mb-4"
        />
        <div class="flex justify-end gap-2">
          <button
            type="button" data-test="resolve-cancel"
            class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated"
            @click="pendingReportId = null"
          >Annuler</button>
          <button
            type="button" data-test="resolve-confirm" :disabled="!resolveNote.trim()"
            class="rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
            @click="confirmResolve"
          >Confirmer</button>
        </div>
      </div>
    </div>

    <!-- Exclure un avis -->
    <ConfirmActionDialog
      :open="pendingExcludeId !== null"
      title="Exclure l'avis"
      message="L'avis sera masqué du score public. Documente la raison."
      confirm-label="Exclure"
      :require-reason="true"
      @confirm="confirmExclude"
      @cancel="pendingExcludeId = null"
    />

    <!-- Supprimer un avis -->
    <ConfirmActionDialog
      :open="pendingRemoveId !== null"
      title="Supprimer l'avis"
      message="Suppression définitive (soft delete). Cette action est irréversible côté public."
      confirm-label="Supprimer"
      @confirm="confirmRemove"
      @cancel="pendingRemoveId = null"
    />
  </div>
</template>
