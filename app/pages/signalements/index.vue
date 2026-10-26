<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import TabBar, { type TabItem } from '@/components/ui/TabBar.vue'
import ReportQueue from '@/features/signalements/components/ReportQueue.vue'
import ReportCase from '@/features/signalements/components/ReportCase.vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import RatingsWorkbench from '@/features/signalements/components/RatingsWorkbench.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import PhotoViewer from '@/components/ui/PhotoViewer.vue'
import RestoreReasonDialog from '@/components/ui/RestoreReasonDialog.vue'
import { useReports } from '@/features/signalements/composables/useReports'
import { useAuthStore } from '@/stores/auth'
import ReportDecisionPanel from '@/features/signalements/components/ReportDecisionPanel.vue'
import ReportReplyDialog from '@/features/signalements/components/ReportReplyDialog.vue'
import { replySentMessage, reporterFirstName, supportConversationLink } from '@/features/signalements/reportReply'
import { REPORT_TARGET_TYPE_LABELS, reportActionTakenLabel } from '@/features/signalements/reportActionLabels'
import { REPORT_KINDS } from '@/features/signalements/reportKind'
import { defaultReportId, neighbourReportId, nextReportId } from '@/features/signalements/reportWorkbench'
import { useWorkbenchShortcuts } from '@/features/signalements/composables/useWorkbenchShortcuts'
import { useReportContext } from '@/features/signalements/composables/useReportContext'
import type { BulkRestoreResult, ReportKind, ReportReplyResponse, ReportStatusFilter, ReportTargetType } from '@/features/signalements/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'REPORT_VIEW', pageTitle: 'Signalements & avis', pageSubtitle: 'Modération des signalements et des avis' })

// L'onglet Avis interroge /admin/ratings, protégé par RATING_MODERATE — une permission
// distincte de celle de la page (REPORT_VIEW). Un compte dont RATING_MODERATE a été révoqué
// par override verrait sinon un onglet qui répond 403 en affichant « aucun avis ».
const auth = useAuthStore()
const activeTab = ref<'reports' | 'ratings'>('reports')
const mainTabs = computed<TabItem<'reports' | 'ratings'>[]>(() => [
  { id: 'reports', label: 'Signalements' },
  ...(auth.can('RATING_MODERATE') ? [{ id: 'ratings' as const, label: 'Avis' }] : []),
])

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
// Signalement ouvert dans le dossier ; le panneau de décision traite celui-là.
const selectedReportId = ref<string | null>(null)
const resolveBusy = ref(false)
const decisionPanel = ref<InstanceType<typeof ReportDecisionPanel> | null>(null)
// Contexte du dossier ouvert (fiches, message, historique) : lu à chaque changement de dossier.
const ctx = useReportContext()
watch(selectedReportId, (id) => { void ctx.load(id) })
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
  if (ok) {
    lastRestored.value = { restored: 1, skipped: 0 }
    void ctx.load(selectedReportId.value)
  }
}
async function confirmBulkRestore() {
  bulkRestoreOpen.value = false
  const res = await r.restoreSelected()
  if (res) lastRestored.value = res
}

// Le signalement ouvert : le panneau de décision en tire ses actions (availableActions du
// back, ou repli local sur un ancien back).
const selectedReport = computed(() => r.findReport(selectedReportId.value))
const hasNextReport = computed(() => nextReportId(r.displayedReports.value, selectedReportId.value) !== null)
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
  selectedReportId.value = id
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

/** Choix de l'admin (clic ou J / K) : les messages du traitement précédent n'ont plus d'objet. */
function selectReport(id: string) {
  if (id === selectedReportId.value) return
  lastReply.value = null
  r.clearResolveFeedback()
  selectedReportId.value = id
  void nextTick(() => document.querySelector(`[data-test="report-row-${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: 'nearest' }))
}
async function confirmResolve(action: string, note: string, targetMessage: string, reporterMessage: string) {
  const id = selectedReportId.value
  if (!id) return
  lastReply.value = null
  resolveBusy.value = true
  const outcome = await r.resolve(id, action, note, targetMessage, reporterMessage)
  resolveBusy.value = false
  // Refus (403, 422, ancien back) : on reste sur le dossier, le panneau montre le détail et
  // garde la saisie. Traité, ou déjà traité par un autre admin (409) : on passe au suivant ;
  // le bandeau de résultat survit au changement de dossier.
  if (outcome === 'error') return
  const next = nextReportId(r.displayedReports.value, id)
  if (next) {
    selectedReportId.value = next
    void nextTick(() => document.querySelector(`[data-test="report-row-${CSS.escape(next)}"]`)?.scrollIntoView?.({ block: 'nearest' }))
  } else {
    // Le dossier reste affiché : sa chronologie doit montrer le geste qui vient d'être fait.
    void ctx.load(id)
  }
}

/** Autre signalement sur la même cible : dans la file, on le sélectionne ; sinon on l'ouvre par son identifiant. */
async function openRelated(id: string) {
  if (r.displayedReports.value.some((x) => x.id === id)) selectReport(id)
  else await focusFromLink(id)
}

// Un dossier est toujours ouvert quand la liste en contient un : au chargement, après un
// changement de filtre ou de page, ou quand celui qui était ouvert a disparu de la liste.
watch(() => r.displayedReports.value, (list) => {
  if (!list.some((x) => x.id === selectedReportId.value)) selectedReportId.value = defaultReportId(list)
})


// Raccourcis du poste de traitement : inactifs sous une fenêtre ouverte ou sur l'onglet Avis.
const windowOpen = computed(() =>
  pendingDeleteId.value !== null || bulkDeleteOpen.value || pendingRestoreId.value !== null
  || bulkRestoreOpen.value || pendingReplyId.value !== null || viewerUrls.value !== null)
useWorkbenchShortcuts({
  enabled: () => activeTab.value === 'reports' && !windowOpen.value,
  move: (step) => {
    const id = neighbourReportId(r.displayedReports.value, selectedReportId.value, step)
    if (id) selectReport(id)
  },
  pick: (n) => decisionPanel.value?.pick(n),
  confirm: () => decisionPanel.value?.submit(),
})

function switchTab(t: 'reports' | 'ratings') {
  activeTab.value = t
}

/** Depuis un avis : le signalement qui le vise s'ouvre dans l'onglet Signalements. */
async function openReportFromRating(id: string) {
  activeTab.value = 'reports'
  await focusFromLink(id)
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
    <TabBar
      class="mb-4" variant="underline" :tabs="mainTabs" :model-value="activeTab"
      aria-label="Sections des signalements" @update:model-value="switchTab"
    />

    <!-- SIGNALEMENTS : poste de traitement, file à gauche, dossier au centre, décision à droite -->
    <div v-show="activeTab === 'reports'">
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

      <!-- Trois colonnes à toute largeur : sous le minimum, la page défile à l'horizontale plutôt que de replier la décision sous le dossier -->
      <div class="overflow-x-auto">
        <div class="grid min-w-[840px] grid-cols-[minmax(240px,1fr)_minmax(300px,1.6fr)_minmax(280px,1.1fr)] items-start gap-4">
          <!-- 1. File d'attente -->
          <section
            aria-label="File des signalements" data-test="report-queue-panel"
            class="flex max-h-[calc(100vh-13rem)] min-h-[24rem] flex-col overflow-hidden rounded-card border border-border bg-surface"
          >
            <div class="flex flex-col gap-2.5 border-b border-border p-3">
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="t in reportStatusTabs" :key="t.value" type="button" :data-test="`report-tab-${t.value}`"
                  :disabled="r.filters.deleted"
                  :class="['rounded-full px-3 py-1 text-sm transition-colors disabled:opacity-40',
                    r.filters.status === t.value && !r.filters.deleted ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
                  @click="r.setStatusFilter(t.value)"
                >{{ t.label }}</button>
                <button
                  v-if="auth.can('REPORT_VIEW')" type="button" data-test="report-filter-deleted"
                  :aria-pressed="r.filters.deleted ? 'true' : 'false'"
                  :class="['rounded-full px-3 py-1 text-sm transition-colors',
                    r.filters.deleted ? 'bg-danger text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
                  @click="toggleDeletedFilter"
                >Supprimés</button>
              </div>
              <input
                type="search" data-test="report-search" :value="searchInput"
                :placeholder="searchPlaceholder" aria-label="Rechercher un signalement"
                class="w-full rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-sm"
                @input="onSearchInput" @keydown.enter.prevent="submitSearch"
              >
              <!-- Type de retour du scarabée (préfixe [BUG] / [AVIS] / [SUGGESTION] de la description) -->
              <div class="flex flex-wrap gap-1" role="group" aria-label="Type de retour">
                <button
                  v-for="k in kindFilters" :key="k.value ?? 'all'" type="button" :data-test="`report-kind-filter-${k.value ?? 'ALL'}`"
                  :aria-pressed="(r.filters.kind ?? null) === k.value ? 'true' : 'false'"
                  :class="['rounded-full px-2.5 py-1 text-xs transition-colors',
                    (r.filters.kind ?? null) === k.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
                  @click="onKindFilter(k.value)"
                >{{ k.label }}</button>
              </div>
              <select
                data-test="report-target-type-filter" aria-label="Type de cible"
                :value="r.filters.targetType ?? ''"
                class="w-full rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted"
                @change="onTargetTypeFilterChange"
              >
                <option v-for="t in targetTypeFilters" :key="t.value ?? 'all'" :value="t.value ?? ''">{{ t.label }}</option>
              </select>
            </div>

            <ReportQueue
              class="min-h-0 flex-1 overflow-hidden"
              :reports="r.displayedReports.value" :loading="r.isLoading.value"
              :selected-id="selectedReportId" :checked="r.selectedIds.value"
              @select="selectReport" @toggle="r.toggleSelect" @toggle-page="r.togglePage"
            />

            <div class="flex flex-col gap-2 border-t border-border bg-bg/50 p-3">
              <PaginationControls :page="r.currentPage.value" :total-pages="r.totalPages.value" @change="r.goToPage" />
              <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                <span class="inline-flex items-center gap-1"><KeyHint>J</KeyHint><KeyHint>K</KeyHint> naviguer</span>
                <span class="inline-flex items-center gap-1"><KeyHint>⏎</KeyHint> confirmer</span>
              </p>
            </div>
          </section>

          <!-- 2. Dossier -->
          <div class="max-h-[calc(100vh-13rem)] min-h-[24rem] overflow-y-auto">
            <ReportCase
              :report="selectedReport" :restore-unavailable="r.restoreUnavailable.value"
              :context="ctx.context.value" :context-loading="ctx.isLoading.value" :context-error="ctx.error.value"
              @open-related="openRelated"
              @view-photos="(urls) => viewerUrls = urls" @reply="openReply"
              @delete="(id) => pendingDeleteId = id"
              @restore="(id) => { lastRestored = null; pendingRestoreId = id }"
            />
          </div>

          <!-- 3. Décision -->
          <div class="sticky top-0">
            <ReportDecisionPanel
              ref="decisionPanel"
              :report="selectedReport" :busy="resolveBusy" :error="r.resolveError.value" :has-next="hasNextReport"
              @confirm="confirmResolve"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- AVIS : même poste de traitement que les signalements -->
    <RatingsWorkbench
      v-show="activeTab === 'ratings' && auth.can('RATING_MODERATE')"
      :active="activeTab === 'ratings' && auth.can('RATING_MODERATE')"
      @open-report="openReportFromRating"
    />

    <!-- Visionneuse des captures d'écran jointes -->
    <PhotoViewer :urls="viewerUrls" @close="viewerUrls = null" />

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
  </div>
</template>
