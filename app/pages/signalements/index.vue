<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ReportsTable from '@/features/signalements/components/ReportsTable.vue'
import RatingsTable from '@/features/signalements/components/RatingsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useReports } from '@/features/signalements/composables/useReports'
import { useRatings } from '@/features/signalements/composables/useRatings'
import type { ReportAction, ReportStatusFilter } from '@/features/signalements/types/index'

definePageMeta({ middleware: 'admin-only', pageTitle: 'Signalements & avis', pageSubtitle: 'Modération des signalements et des avis' })

const activeTab = ref<'reports' | 'ratings'>('reports')

// ---- Signalements ----
const r = useReports()
const reportStatusTabs: { value: ReportStatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'Ouverts' },
  { value: 'RESOLVED', label: 'Résolus' },
  { value: 'DISMISSED', label: 'Rejetés' },
  { value: 'ALL', label: 'Tous' },
]
const reportActions: { value: ReportAction; label: string }[] = [
  { value: 'DISMISS', label: 'Rejeter le signalement' },
  { value: 'WARN', label: 'Avertir' },
  { value: 'SUSPEND_TARGET', label: 'Suspendre la cible' },
  { value: 'REMOVE_CONTENT', label: 'Retirer le contenu' },
]
const pendingReportId = ref<string | null>(null)
const chosenAction = ref<ReportAction>('WARN')
const resolveNote = ref('')
const viewerUrls = ref<string[] | null>(null)

function openResolve(id: string) {
  pendingReportId.value = id
  chosenAction.value = 'WARN'
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
        type="button" data-test="tab-ratings"
        :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          activeTab === 'ratings' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text']"
        @click="switchTab('ratings')"
      >Avis</button>
    </div>

    <!-- SIGNALEMENTS -->
    <div v-show="activeTab === 'reports'">
      <div class="flex gap-1 mb-4">
        <button
          v-for="t in reportStatusTabs" :key="t.value" type="button" :data-test="`report-tab-${t.value}`"
          :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
            r.filters.status === t.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="r.setStatusFilter(t.value)"
        >{{ t.label }}</button>
      </div>

      <ReportsTable :reports="r.reports.value" :loading="r.isLoading.value" @resolve="openResolve" @view-photos="(urls) => viewerUrls = urls" />

      <div class="mt-4">
        <PaginationControls :page="r.currentPage.value" :total-pages="r.totalPages.value" @change="r.goToPage" />
      </div>
    </div>

    <!-- AVIS -->
    <div v-show="activeTab === 'ratings'">
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
          <option v-for="a in reportActions" :key="a.value" :value="a.value">{{ a.label }}</option>
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
