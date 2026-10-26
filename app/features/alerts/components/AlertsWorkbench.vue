<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import AlertQueue from './AlertQueue.vue'
import AlertCase from './AlertCase.vue'
import AlertDecisionPanel from './AlertDecisionPanel.vue'
import { useAlerts } from '@/features/alerts/composables/useAlerts'
import { useAlertSummary } from '@/features/alerts/composables/useAlertSummary'
import { useOpenAlert } from '@/features/alerts/composables/useOpenAlert'
import { useWorkbenchShortcuts } from '@/features/signalements/composables/useWorkbenchShortcuts'
import {
  alertCategories,
  alertNoteFor,
  defaultAlertId,
  filterAlerts,
  followingAlertId,
  groupAlerts,
  neighbourAlertId,
  queueOrder,
  type AlertAction,
  type DecisionScope,
} from '@/features/alerts/lib/alertWorkbench'
import type { AlertSeverity, ResolvedFilter } from '@/features/alerts/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

/**
 * Poste de traitement des alertes : file (alertes de même type regroupées) à gauche, dossier au
 * centre, décision à droite. L'alerte ouverte vit dans l'URL (`?open=<id>`), écrite sans pile
 * d'historique : un lien « Ouvrir l'alerte » d'une autre page atterrit dessus.
 */
const { alerts, isLoading, error: alertsError, totalPages, currentPage, filters, fetchAlerts, goToPage, setResolvedFilter, setSeverityFilter, resolve, resolveMany, markResolvedLocally } = useAlerts()
const { selected, openError, open, close, openById } = useOpenAlert(alerts)
const { summary, loaded: summaryLoaded, refresh: refreshSummary } = useAlertSummary()

const query = ref('')
const category = ref<string | null>(null)
const expanded = ref<string[]>([])
const busy = ref(false)
/** Refus d'un geste : montré dans le panneau, saisie conservée. */
const decisionError = ref<string | null>(null)
const doneMessage = ref('')
const decisionPanel = ref<InstanceType<typeof AlertDecisionPanel> | null>(null)
let ready = false

const route = useRoute()
const router = useRouter()
const queryOpen = () => {
  const v = route.query?.open
  return typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : undefined
}
function writeOpen(id: string | null) {
  if ((id ?? undefined) === queryOpen()) return
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) if (k !== 'open' && typeof v === 'string') q[k] = v
  if (id) q.open = id
  void router.replace({ query: q })
}

// ---- File ----
const visible = computed(() => filterAlerts(alerts.value, { query: query.value, category: category.value }))
const groups = computed(() => groupAlerts(visible.value))
const order = computed(() => queueOrder(groups.value))
const categories = computed(() => alertCategories(alerts.value))
const selectedId = computed(() => selected.value?.id ?? null)
const hasNext = computed(() => followingAlertId(order.value, selectedId.value) !== null)
/** Alertes ouvertes du groupe de l'alerte choisie : au-delà d'une, on propose de les résoudre ensemble. */
const groupOpenAlerts = computed(() => {
  const s = selected.value
  if (!s || s.resolved) return []
  const g = groups.value.find((x) => x.alerts.some((a) => a.id === s.id))
  return g ? g.alerts.filter((a) => !a.resolved) : [s]
})

function resetFeedback() {
  decisionError.value = null
  doneMessage.value = ''
}
function scrollTo(id: string) {
  void nextTick(() => document.querySelector(`[data-test="alert-row-${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: 'nearest' }))
}
/** Choix de l'admin (clic ou J / K) : le résultat du geste précédent n'a plus d'objet. */
function selectAlert(id: string) {
  const a = alerts.value.find((x) => x.id === id)
  if (!a || id === selectedId.value) return
  resetFeedback()
  open(a)
  writeOpen(id)
  scrollTo(id)
}
function toggleGroup(key: string) {
  if (expanded.value.includes(key)) { expanded.value = expanded.value.filter((k) => k !== key); return }
  expanded.value = [...expanded.value, key]
  const first = groups.value.find((g) => g.key === key)?.alerts[0]
  if (first) selectAlert(first.id)
}

// Une alerte est toujours ouverte quand la liste en contient une : au chargement, après un
// filtre, ou quand celle qui l'était a disparu. Une alerte ouverte par lien hors liste reste.
let pinned = false
watch(order, (list) => {
  if (!ready) return
  if (selected.value && (pinned || list.some((a) => a.id === selected.value!.id))) return
  const id = defaultAlertId(list)
  const a = id ? alerts.value.find((x) => x.id === id) : null
  // Affectation directe : `open` / `close` effaceraient le message d'un lien introuvable.
  if (a) selected.value = a
  else if (selected.value) selected.value = null
})
// Liste rechargée : l'alerte ouverte reprend ses données fraîches (état, date de résolution).
watch(alerts, (list) => {
  const fresh = list.find((a) => a.id === selected.value?.id)
  if (fresh) selected.value = fresh
})

// ---- Filtres ----
async function setTab(r: ResolvedFilter) { resetFeedback(); await setResolvedFilter(r) }
async function toggleSeverity(s: AlertSeverity) {
  resetFeedback()
  await setSeverityFilter(filters.severity === s ? null : s)
}
async function showResolved() { await setTab('RESOLVED') }
const TABS: { value: ResolvedFilter; label: string }[] = [
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'RESOLVED', label: 'Résolues' },
  { value: 'ALL', label: 'Toutes' },
]
const chip = (on: boolean) => ['rounded-full px-3 py-1 text-sm transition-colors',
  on ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']
const catChip = (on: boolean) => ['rounded-full border px-2.5 py-0.5 text-xs transition-colors',
  on ? 'border-primary font-medium text-primary' : 'border-border text-text-muted hover:text-text']

// ---- Décision ----
async function confirm(action: AlertAction, note: string, scope: DecisionScope) {
  const s = selected.value
  if (!s) return
  const text = alertNoteFor(action, note)
  const ids = scope === 'group' ? groupOpenAlerts.value.map((a) => a.id) : [s.id]
  // Le suivant se lit AVANT le geste : une alerte résolue quitte la liste « Ouvertes ».
  const next = followingAlertId(order.value.filter((a) => !ids.includes(a.id) || a.id === s.id), s.id)
  busy.value = true
  resetFeedback()
  let failed: string[] = []
  try {
    if (scope === 'group') failed = await resolveMany(ids, text)
    else await resolve(s.id, text)
  } catch (e) {
    busy.value = false
    decisionError.value = extractProblemMessage(e, 'Résolution refusée')
    return
  }
  busy.value = false
  void refreshSummary()
  if (failed.length) decisionError.value = `${failed.length} alerte${failed.length > 1 ? 's' : ''} n’${failed.length > 1 ? 'ont' : 'a'} pas pu être résolue${failed.length > 1 ? 's' : ''} : elle${failed.length > 1 ? 's restent ouvertes' : ' reste ouverte'}.`
  const done = ids.length - failed.length
  doneMessage.value = done > 1 ? `${done} alertes résolues.` : 'Alerte résolue.'
  const list = order.value
  const target = next && list.some((a) => a.id === next) ? next : (list.some((a) => a.id === s.id) ? s.id : defaultAlertId(list))
  const a = target ? alerts.value.find((x) => x.id === target) : null
  if (a) { open(a); writeOpen(a.id); scrollTo(a.id) } else { close(); writeOpen(null) }
}

/** Résolution automatique par la resynchronisation Stripe : liste et dossier ouvert à jour. */
function onAutoResolved(ids: string[]) {
  const at = new Date().toISOString()
  markResolvedLocally(ids, at)
  void refreshSummary()
  if (selected.value && ids.includes(selected.value.id) && !selected.value.resolved) {
    selected.value = { ...selected.value, resolved: true, resolvedAt: at }
  }
}
/** Versement forcé : le back a pu résoudre d'autres alertes du paiement, on recharge. */
async function onChanged() {
  await fetchAlerts()
  void refreshSummary()
}
/** « Marquer comme résolue » proposé dans le dossier : on place la main sur la décision. */
function focusDecision() {
  decisionPanel.value?.pick(1)
  void nextTick(() => document.getElementById('alert-note')?.focus())
}

// ---- Raccourcis : J / K, 1 et 2, ⏎ ----
useWorkbenchShortcuts({
  enabled: () => true,
  move: (step) => {
    const id = neighbourAlertId(order.value, selectedId.value, step)
    if (id) selectAlert(id)
  },
  pick: (n) => decisionPanel.value?.pick(n),
  confirm: () => decisionPanel.value?.submit(),
})

// ---- Lien profond ----
async function openFromQuery(id: string | undefined) {
  await openById(id)
  pinned = !!selected.value && !order.value.some((a) => a.id === selected.value!.id)
}
onMounted(async () => {
  await Promise.all([fetchAlerts(), refreshSummary()])
  ready = true
  await openFromQuery(queryOpen())
  if (!selected.value) {
    const id = defaultAlertId(order.value)
    const a = id ? alerts.value.find((x) => x.id === id) : null
    if (a) selected.value = a
  }
})
// Page déjà ouverte : un nouveau lien (query seule) ouvre l'alerte, le retrait de `open` ferme le lien introuvable.
// Une fois la page quittée (`?open=` d'une autre page, un paiement par exemple), plus rien n'est lu.
const onThisPage = () => /^\/alertes\/?$/.test(route.path ?? '')
watch(() => (onThisPage() ? queryOpen() : null), (id) => {
  if (id) void openFromQuery(id)
  else if (id === undefined) openError.value = null
})
</script>

<template>
  <div data-test="alerts-workbench">
    <!-- Synthèse : chaque compteur filtre la file -->
    <section aria-label="Synthèse" class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-test="alert-summary">
      <button
        type="button" data-test="summary-CRITICAL" :aria-pressed="filters.severity === 'CRITICAL' ? 'true' : 'false'"
        :class="['rounded-card border bg-surface p-3 text-left transition-colors hover:bg-surface-elevated', filters.severity === 'CRITICAL' ? 'border-2 border-danger' : 'border-border']"
        @click="toggleSeverity('CRITICAL')"
      >
        <span class="block text-xs font-semibold uppercase tracking-wide text-danger">Critiques ouvertes</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums">{{ summary.critical }}</span>
          <span v-if="summary.oldestCritical" class="text-xs text-text-muted">plus ancienne : {{ summary.oldestCritical }}</span>
        </span>
      </button>
      <button
        type="button" data-test="summary-WARN" :aria-pressed="filters.severity === 'WARN' ? 'true' : 'false'"
        :class="['rounded-card border bg-surface p-3 text-left transition-colors hover:bg-surface-elevated', filters.severity === 'WARN' ? 'border-2 border-warning' : 'border-border']"
        @click="toggleSeverity('WARN')"
      >
        <span class="block text-xs font-semibold uppercase tracking-wide text-warning">Attention ouvertes</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums">{{ summary.warn }}</span>
          <span v-if="summary.warn > 0" class="text-xs text-text-muted">en {{ summary.warnGroups }} groupe{{ summary.warnGroups > 1 ? 's' : '' }}</span>
        </span>
      </button>
      <button
        type="button" data-test="summary-INFO" :aria-pressed="filters.severity === 'INFO' ? 'true' : 'false'"
        :class="['rounded-card border bg-surface p-3 text-left transition-colors hover:bg-surface-elevated', filters.severity === 'INFO' ? 'border-2 border-primary' : 'border-border']"
        @click="toggleSeverity('INFO')"
      >
        <span class="block text-xs font-semibold uppercase tracking-wide text-text-muted">Info ouvertes</span>
        <span class="font-display text-3xl font-bold tabular-nums">{{ summary.info }}</span>
      </button>
      <button
        type="button" data-test="summary-RESOLVED"
        class="rounded-card border border-border bg-surface p-3 text-left transition-colors hover:bg-surface-elevated"
        @click="showResolved"
      >
        <span class="block text-xs font-semibold uppercase tracking-wide text-success">Résolues cette semaine</span>
        <span class="font-display text-3xl font-bold tabular-nums">{{ summary.resolvedThisWeek }}</span>
      </button>
    </section>
    <p v-if="!summaryLoaded" data-test="summary-unavailable" class="sr-only">Compteurs indisponibles</p>

    <p
      v-if="openError" data-test="alert-open-error" role="status"
      class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
    >{{ openError }}. Elle a peut-être été supprimée, ou le lien est incomplet : cherchez-la dans la liste.</p>
    <p
      v-if="doneMessage" data-test="alerts-done" role="status"
      class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
    >{{ doneMessage }}</p>

    <!-- Trois colonnes à toute largeur, comme l'onglet Signalements -->
    <div class="overflow-x-auto">
      <div class="grid min-w-[840px] grid-cols-[minmax(260px,1fr)_minmax(320px,1.7fr)_minmax(280px,1.05fr)] items-start gap-4">
        <!-- 1. File des alertes -->
        <section
          aria-label="File des alertes" data-test="alert-queue-panel"
          class="flex max-h-[calc(100vh-18rem)] min-h-[24rem] flex-col overflow-hidden rounded-card border border-border bg-surface"
        >
          <div class="flex flex-col gap-2 border-b border-border p-3">
            <div class="flex flex-wrap gap-1">
              <button
                v-for="t in TABS" :key="t.value" type="button" :data-test="`tab-${t.value}`"
                :aria-pressed="filters.resolved === t.value ? 'true' : 'false'" :class="chip(filters.resolved === t.value)"
                @click="setTab(t.value)"
              >{{ t.label }}</button>
            </div>
            <input
              v-model="query" type="search" data-test="alert-search" aria-label="Rechercher une alerte"
              placeholder="Rechercher : paiement, colis, code…"
              class="w-full rounded-btn border border-border bg-bg px-3 py-1.5 text-sm"
            >
            <div v-if="categories.length > 1" class="flex flex-wrap gap-1" data-test="alert-categories">
              <button
                type="button" data-test="category-ALL" :aria-pressed="category === null ? 'true' : 'false'"
                :class="catChip(category === null)" @click="category = null"
              >Toutes catégories</button>
              <button
                v-for="c in categories" :key="c" type="button" :data-test="`category-${c}`"
                :aria-pressed="category === c ? 'true' : 'false'" :class="catChip(category === c)"
                @click="category = category === c ? null : c"
              >{{ c }}</button>
            </div>
          </div>

          <AlertQueue
            class="min-h-0 flex-1 overflow-hidden"
            :groups="groups" :loading="isLoading" :error="alertsError" :selected-id="selectedId" :expanded="expanded"
            @select="selectAlert" @toggle="toggleGroup" @retry="fetchAlerts"
          />

          <div class="flex flex-col gap-2 border-t border-border bg-bg/50 p-3">
            <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span class="inline-flex items-center gap-1"><KeyHint>J</KeyHint><KeyHint>K</KeyHint> naviguer</span>
              <span class="inline-flex items-center gap-1"><KeyHint>⏎</KeyHint> confirmer</span>
            </p>
          </div>
        </section>

        <!-- 2. Dossier -->
        <div class="max-h-[calc(100vh-18rem)] min-h-[24rem] overflow-y-auto">
          <AlertCase :alert="selected" @auto-resolved="onAutoResolved" @changed="onChanged" @resolve="focusDecision" />
        </div>

        <!-- 3. Décision -->
        <div class="sticky top-0">
          <AlertDecisionPanel
            ref="decisionPanel"
            :alert="selected" :group-open-count="groupOpenAlerts.length || 1" :busy="busy" :error="decisionError" :has-next="hasNext"
            @confirm="confirm"
          />
        </div>
      </div>
    </div>
  </div>
</template>
