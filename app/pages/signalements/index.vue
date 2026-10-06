<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ReportsTable from '@/features/signalements/components/ReportsTable.vue'
import RatingsTable from '@/features/signalements/components/RatingsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import PhotoViewer from '@/components/ui/PhotoViewer.vue'
import RestoreReasonDialog from '@/components/ui/RestoreReasonDialog.vue'
import { useReports } from '@/features/signalements/composables/useReports'
import { useRatings } from '@/features/signalements/composables/useRatings'
import { useAuthStore } from '@/stores/auth'
import ReportResolveDialog from '@/features/signalements/components/ReportResolveDialog.vue'
import ReportReplyDialog from '@/features/signalements/components/ReportReplyDialog.vue'
import { replySentMessage, reporterFirstName, supportConversationLink } from '@/features/signalements/reportReply'
import { REPORT_TARGET_TYPE_LABELS, reportActionTakenLabel } from '@/features/signalements/reportActionLabels'
import { REPORT_KINDS } from '@/features/signalements/reportKind'
import type { BulkRestoreResult, ReportKind, ReportReplyResponse, ReportStatusFilter, ReportTargetType } from '@/features/signalements/types/index'

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
const kindFilters: { value: ReportKind | null; label: string }[] = [
  { value: null, label: 'Tous retours' },
  ...REPORT_KINDS,
]
const pendingReportId = ref<string | null>(null)
const resolveBusy = ref(false)
const viewerUrls = ref<string[] | null>(null)

// ---- Recherche (débounce court : une requête par pause de frappe) ----
const searchInput = ref('')
// Dans la corbeille, le back ne cherche pas dans le nom du signalant.
const searchPlaceholder = computed(() => r.filters.deleted
  ? 'Rechercher (texte, écran, motif)'
  : 'Rechercher (texte, écran, signalant, motif)')
let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput(e: Event) {
  searchInput.value = (e.target as HTMLInputElement).value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => r.setQuery(searchInput.value), 300)
}
function onKindFilter(k: ReportKind | null) {
  if (searchTimer) clearTimeout(searchTimer)
  if (k) searchInput.value = ''
  r.setKindFilter(k)
}
function submitSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  r.setQuery(searchInput.value)
}

// ---- Suppression (unitaire ou groupée), toujours confirmée ----
const pendingDeleteId = ref<string | null>(null)
const bulkDeleteOpen = ref(false)
const lastDeleted = ref<number | null>(null)
const deleteMessage = computed(() => {
  if (pendingDeleteId.value) return 'Le signalement sera masqué de l’admin (suppression douce). Ses captures et son audit restent en base.'
  const n = r.selectedCount.value
  const scope = r.allResultsSelected.value ? 'tous les résultats de la recherche courante' : 'la sélection'
  return `${n} signalement${n > 1 ? 's' : ''} (${scope}) seront masqués de l’admin (suppression douce).`
})
async function confirmDelete() {
  lastRestored.value = null
  if (pendingDeleteId.value) {
    await r.deleteOne(pendingDeleteId.value)
    lastDeleted.value = 1
    pendingDeleteId.value = null
    return
  }
  lastDeleted.value = await r.deleteSelected()
  bulkDeleteOpen.value = false
}

// ---- Restauration (unitaire motivée, ou groupée) ----
const pendingRestoreId = ref<string | null>(null)
const restoreBusy = ref(false)
const bulkRestoreOpen = ref(false)
const lastRestored = ref<BulkRestoreResult | null>(null)
const plural = (n: number) => (n > 1 ? 's' : '')
const restoredMessage = computed(() => {
  const res = lastRestored.value
  if (!res) return ''
  const done = `${res.restored} signalement${plural(res.restored)} restauré${plural(res.restored)}`
  return res.skipped > 0 ? `${done}, ${res.skipped} ignoré${plural(res.skipped)} (déjà actif${plural(res.skipped)}).` : `${done}.`
})
const bulkRestoreMessage = computed(() => {
  const n = Math.min(r.selectedIds.value.length, 100)
  return `${n} signalement${plural(n)} redeviendr${n > 1 ? 'ont' : 'a'} visible${plural(n)} dans l’admin. Ceux déjà actifs seront ignorés.`
})
async function toggleDeletedFilter() {
  lastDeleted.value = null
  lastRestored.value = null
  await r.setDeletedFilter(!r.filters.deleted)
}
async function confirmRestore(reason: string) {
  if (!pendingRestoreId.value) return
  restoreBusy.value = true
  const ok = await r.restoreOne(pendingRestoreId.value, reason)
  restoreBusy.value = false
  // Motif refusé (422) : le dialogue reste ouvert, saisie conservée, refus affiché dedans.
  if (r.reasonError.value) return
  pendingRestoreId.value = null
  if (ok) lastRestored.value = { restored: 1, skipped: 0 }
}
async function confirmBulkRestore() {
  bulkRestoreOpen.value = false
  const res = await r.restoreSelected()
  if (res) lastRestored.value = res
}

// Le signalement en cours de traitement : le dialogue en tire ses actions (availableActions
// du back, ou repli local sur un ancien back).
const pendingReport = computed(() => r.findReport(pendingReportId.value))
const resolvedMessage = computed(() => {
  const done = r.lastResolved.value
  if (!done) return ''
  if (done.status === 'DISMISSED') return 'Signalement rejeté.'
  return done.actionTaken ? `Signalement traité : ${reportActionTakenLabel(done.actionTaken)}.` : 'Signalement traité.'
})

function onTargetTypeFilterChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  r.setTargetTypeFilter(value === '' ? null : (value as ReportTargetType))
}

// ---- Répondre au signalant d'un rapport de bug (le signalement garde son statut) ----
const pendingReplyId = ref<string | null>(null)
const replyReport = computed(() => r.findReport(pendingReplyId.value))
const lastReply = ref<{ ticketId: string; text: string } | null>(null)
function openReply(id: string) {
  lastReply.value = null
  pendingReplyId.value = id
}
function onReplySent(response: ReportReplyResponse) {
  const report = replyReport.value
  if (report) {
    r.markReplied(report.id, response.ticketId)
    const firstName = reporterFirstName(report.reporterName, response.ticket?.userDisplayName)
    lastReply.value = { ticketId: response.ticketId, text: replySentMessage(firstName, response.created !== false) }
  }
  pendingReplyId.value = null
}

// ---- Lien profond ?open=<id> (depuis une conversation support issue d'un signalement) ----
const route = useRoute()
const router = useRouter()
function openParam(): string | null {
  const v = route.query?.open
  return typeof v === 'string' && v ? v : null
}
async function focusFromLink(id: string) {
  await r.openReport(id)
  if (!r.focusedReport.value) return
  await nextTick()
  document.querySelector(`[data-test="report-row-${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: 'center' })
}
/** Fermer retire ?open= : un nouveau clic sur le même lien rouvrira le signalement. */
function closeFocus() {
  r.closeFocus()
  if (!openParam()) return
  const query = { ...(route.query ?? {}) }
  delete query.open
  void router.replace({ query })
}
watch(() => route.query?.open, (v) => {
  if (typeof v === 'string' && v && v !== r.focusedReport.value?.id) void focusFromLink(v)
})

function openResolve(id: string) {
  lastReply.value = null
  r.clearResolveFeedback()
  pendingReportId.value = id
}
function cancelResolve() {
  pendingReportId.value = null
  r.resolveError.value = null
}
async function confirmResolve(action: string, note: string) {
  if (!pendingReportId.value) return
  resolveBusy.value = true
  const outcome = await r.resolve(pendingReportId.value, action, note)
  resolveBusy.value = false
  // Refus (403, 422, ancien back) : le dialogue reste ouvert et montre le detail. Déjà
  // traité par un autre admin (409) : on ferme, la liste relue montre son état réel.
  if (outcome !== 'error') pendingReportId.value = null
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
  if (pendingRemoveId.value) await rt.remove(pendingRemoveId.value, reason)
  pendingRemoveId.value = null
}
const pendingRatingRestoreId = ref<string | null>(null)
const ratingRestoreBusy = ref(false)
const ratingRestored = ref(false)
async function confirmRatingRestore(reason: string) {
  if (!pendingRatingRestoreId.value) return
  ratingRestoreBusy.value = true
  ratingRestored.value = await rt.restore(pendingRatingRestoreId.value, reason)
  ratingRestoreBusy.value = false
  if (rt.reasonError.value) return
  pendingRatingRestoreId.value = null
}
async function toggleRatingsDeleted(v: boolean) {
  ratingRestored.value = false
  await rt.setDeletedFilter(v)
}

function switchTab(t: 'reports' | 'ratings') {
  activeTab.value = t
  if (t === 'ratings' && rt.ratings.value.length === 0) rt.fetchRatings()
}

onMounted(async () => {
  await r.fetchReports()
  const id = openParam()
  if (id) await focusFromLink(id)
})
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
            :disabled="r.filters.deleted"
            :class="['rounded-full px-3 py-1.5 text-sm transition-colors disabled:opacity-40',
              r.filters.status === t.value && !r.filters.deleted ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
            @click="r.setStatusFilter(t.value)"
          >{{ t.label }}</button>
          <button
            v-if="auth.can('REPORT_VIEW')" type="button" data-test="report-filter-deleted"
            :aria-pressed="r.filters.deleted ? 'true' : 'false'"
            :class="['ml-1 rounded-full px-3 py-1.5 text-sm transition-colors',
              r.filters.deleted ? 'bg-danger text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
            @click="toggleDeletedFilter"
          >Supprimés</button>
        </div>
        <input
          type="search" data-test="report-search" :value="searchInput"
          :placeholder="searchPlaceholder"
          class="min-w-64 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-sm"
          @input="onSearchInput" @keydown.enter.prevent="submitSearch"
        >
        <!-- Type de retour du scarabée (préfixe [BUG] / [AVIS] / [SUGGESTION] de la description) -->
        <div class="flex gap-1" role="group" aria-label="Type de retour">
          <button
            v-for="k in kindFilters" :key="k.value ?? 'all'" type="button" :data-test="`report-kind-filter-${k.value ?? 'ALL'}`"
            :aria-pressed="(r.filters.kind ?? null) === k.value ? 'true' : 'false'"
            :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
              (r.filters.kind ?? null) === k.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
            @click="onKindFilter(k.value)"
          >{{ k.label }}</button>
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
      <p
        v-if="r.deletedFilterUnsupported.value" data-test="reports-deleted-filter-unsupported"
        class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
      >Filtre disponible après mise à jour du serveur : il ne sait pas encore isoler les signalements supprimés.</p>
      <p
        v-if="r.restoreUnavailable.value" data-test="reports-restore-unavailable"
        class="mb-3 rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >Restauration indisponible tant que le serveur n’est pas mis à jour.</p>
      <p
        v-if="lastRestored" data-test="reports-restored" role="status"
        class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success tabular-nums"
      >{{ restoredMessage }}</p>
      <p
        v-if="resolvedMessage" data-test="reports-resolved" role="status"
        class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success text-pretty"
      >{{ resolvedMessage }}</p>
      <p
        v-if="r.closedNotice.value" data-test="reports-already-closed" role="status"
        class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
      >{{ r.closedNotice.value }}</p>
      <p
        v-if="lastReply" data-test="reports-reply-sent" role="status"
        class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success text-pretty"
      >
        <span>{{ lastReply.text }}</span>
        <NuxtLink
          v-if="auth.can('SUPPORT_TICKET_VIEW')" :to="supportConversationLink(lastReply.ticketId)"
          data-test="reports-reply-open" class="font-medium underline underline-offset-2"
        >Ouvrir la conversation</NuxtLink>
      </p>
      <p
        v-if="r.focusedReport.value" data-test="reports-focus" role="status"
        class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-btn border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-text text-pretty"
      >
        <span>Signalement ouvert depuis une conversation support : il est affiché en tête de liste.</span>
        <button type="button" data-test="reports-focus-close" class="text-primary underline-offset-2 hover:underline" @click="closeFocus">Retirer</button>
      </p>
      <p
        v-if="r.focusError.value" data-test="reports-focus-error" role="alert"
        class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
      >{{ r.focusError.value }}</p>
      <p v-if="lastDeleted !== null" data-test="reports-deleted" class="mb-3 rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted">
        {{ lastDeleted }} signalement{{ lastDeleted > 1 ? 's' : '' }} supprimé{{ lastDeleted > 1 ? 's' : '' }}.
      </p>

      <!-- Barre de sélection (modèle Gmail) -->
      <div
        v-if="r.selectedCount.value > 0" data-test="selection-bar"
        class="mb-3 flex flex-wrap items-center gap-3 rounded-btn border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
      >
        <span data-test="selection-count">
          {{ r.selectedCount.value }} sélectionné{{ r.selectedCount.value > 1 ? 's' : '' }}{{ r.allResultsSelected.value ? ' (tous les résultats)' : ' sur cette page' }}
        </span>
        <button
          v-if="r.canSelectAllResults.value" type="button" data-test="select-all-results"
          class="text-primary underline-offset-2 hover:underline"
          @click="r.selectAllResults()"
        >Sélectionner les {{ r.totalElements.value }} résultats</button>
        <span class="grow"/>
        <button
          type="button" data-test="clear-selection"
          class="rounded-btn px-3 py-1.5 border border-border hover:bg-surface-elevated"
          @click="r.clearSelection()"
        >Annuler</button>
        <button
          v-if="r.filters.deleted && !r.restoreUnavailable.value" type="button" data-test="bulk-restore"
          class="rounded-btn px-3 py-1.5 bg-primary text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96]"
          @click="bulkRestoreOpen = true"
        >Restaurer la sélection ({{ r.selectedCount.value }})</button>
        <button
          v-else-if="!r.filters.deleted" type="button" data-test="bulk-delete"
          class="rounded-btn px-3 py-1.5 bg-danger text-white hover:bg-danger/90"
          @click="bulkDeleteOpen = true"
        >Supprimer ({{ r.selectedCount.value }})</button>
      </div>

      <ReportsTable
        :reports="r.displayedReports.value" :loading="r.isLoading.value" :selected="r.selectedIds.value"
        :highlight-id="r.focusedReport.value?.id ?? null"
        :restore-unavailable="r.restoreUnavailable.value"
        @restore="(id) => { lastRestored = null; pendingRestoreId = id }"
        @resolve="openResolve" @reply="openReply" @view-photos="(urls) => viewerUrls = urls"
        @toggle="r.toggleSelect" @toggle-page="r.togglePage" @delete="(id) => pendingDeleteId = id"
      />

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
      <label class="flex items-center gap-2 mb-4 text-sm text-text-muted cursor-pointer">
        <input
          type="checkbox" data-test="ratings-deleted-only"
          :checked="rt.filters.deleted"
          @change="toggleRatingsDeleted(($event.target as HTMLInputElement).checked)"
        >
        Supprimés
      </label>

      <p
        v-if="rt.deletedFilterUnsupported.value" data-test="ratings-deleted-filter-unsupported"
        class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
      >Filtre disponible après mise à jour du serveur : il ne sait pas encore isoler les avis supprimés.</p>
      <p
        v-if="rt.restoreUnavailable.value" data-test="ratings-restore-unavailable"
        class="mb-3 rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >Restauration indisponible tant que le serveur n’est pas mis à jour.</p>
      <p
        v-if="ratingRestored" data-test="ratings-restored" role="status"
        class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
      >Avis restauré : la note moyenne du voyageur est recalculée.</p>

      <p
        v-if="rt.error.value" data-test="ratings-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ rt.error.value }}</p>

      <RatingsTable
        :ratings="rt.ratings.value" :loading="rt.isLoading.value" :restore-unavailable="rt.restoreUnavailable.value" :non-restorable-ids="rt.supersededIds.value"
        @restore="(id) => { ratingRestored = false; pendingRatingRestoreId = id }"
        @exclude="(id) => pendingExcludeId = id" @remove="(id) => pendingRemoveId = id"
      />

      <div class="mt-4">
        <PaginationControls :page="rt.currentPage.value" :total-pages="rt.totalPages.value" @change="rt.goToPage" />
      </div>
    </div>

    <!-- Visionneuse des captures d'écran jointes -->
    <PhotoViewer :urls="viewerUrls" @close="viewerUrls = null" />

    <!-- Dialogue de résolution d'un signalement (action + note) -->
    <ReportResolveDialog
      :report="pendingReport" :busy="resolveBusy" :error="r.resolveError.value"
      @confirm="confirmResolve" @cancel="cancelResolve"
    />

    <!-- Répondre au signalant d'un rapport de bug -->
    <ReportReplyDialog :report="replyReport" @close="pendingReplyId = null" @sent="onReplySent" />

    <!-- Supprimer un ou plusieurs signalements -->
    <ConfirmActionDialog
      :open="pendingDeleteId !== null || bulkDeleteOpen"
      :title="pendingDeleteId ? 'Supprimer le signalement' : 'Supprimer la sélection'"
      :message="deleteMessage"
      confirm-label="Supprimer"
      @confirm="confirmDelete"
      @cancel="pendingDeleteId = null; bulkDeleteOpen = false"
    />

    <!-- Restaurer un signalement supprimé (motif journalisé) -->
    <RestoreReasonDialog
      :open="pendingRestoreId !== null"
      title="Restaurer le signalement"
      message="Le signalement redevient visible dans l’admin, avec son statut d’avant la suppression."
      confirm-label="Restaurer"
      :busy="restoreBusy" :error="r.reasonError.value"
      @confirm="confirmRestore"
      @cancel="pendingRestoreId = null; r.reasonError.value = null"
    />

    <!-- Restaurer la sélection -->
    <ConfirmActionDialog
      :open="bulkRestoreOpen"
      title="Restaurer la sélection"
      :message="bulkRestoreMessage"
      confirm-label="Restaurer"
      confirm-tone="primary"
      @confirm="confirmBulkRestore"
      @cancel="bulkRestoreOpen = false"
    />

    <!-- Restaurer un avis supprimé -->
    <RestoreReasonDialog
      :open="pendingRatingRestoreId !== null"
      title="Restaurer l’avis"
      message="L’avis redevient public sur le profil du voyageur."
      notice="La note moyenne du voyageur sera recalculée avec cet avis."
      confirm-label="Restaurer"
      :busy="ratingRestoreBusy" :error="rt.reasonError.value"
      @confirm="confirmRatingRestore"
      @cancel="pendingRatingRestoreId = null; rt.reasonError.value = null"
    />

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
      :require-reason="true"
      @confirm="confirmRemove"
      @cancel="pendingRemoveId = null"
    />
  </div>
</template>
