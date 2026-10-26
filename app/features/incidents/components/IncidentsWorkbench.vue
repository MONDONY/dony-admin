<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import IncidentQueue from './IncidentQueue.vue'
import IncidentCase from './IncidentCase.vue'
import IncidentDecisionPanel from './IncidentDecisionPanel.vue'
import { useIncidents } from '@/features/incidents/composables/useIncidents'
import { useIncidentContext } from '@/features/incidents/composables/useIncidentContext'
import { useDisputeDetail } from '@/features/incidents/composables/useDisputeDetail'
import { useNoShowDecision } from '@/features/incidents/composables/useNoShowDecision'
import { useWorkbenchShortcuts } from '@/features/signalements/composables/useWorkbenchShortcuts'
import {
  defaultIncidentKey, disputeIncident, disputeKey, filterIncidents, followingIncidentKey, groupIncidents,
  neighbourIncidentKey, noShowIncident, noShowKey, queueOrder, summarizeIncidents,
  type Incident, type KindFilter, type TabFilter,
} from '@/features/incidents/lib/incidentWorkbench'
import { formatMajorAmount } from '@/features/finance/types/index'
import type { DisputeResolution, NoShowDecision } from '@/features/incidents/types/index'

/**
 * Poste de traitement des incidents : file fusionnée (litiges et déclarations d'absence, regroupés
 * par nature) à gauche, dossier au centre, décision à droite. L'incident ouvert vit dans l'URL
 * (`?open=<id>`, avec `tab=noshows` pour une absence) : liens des notifications, des colis et des
 * paiements. Écrite sans pile d'historique.
 */
const { incidents, todo, tab, isLoading, error, warning, truncated, noshows, fetch, setTab } = useIncidents()
const detail = useDisputeDetail()
const ctx = useIncidentContext()
const noshowDecision = useNoShowDecision(fetch)

const query = ref('')
const kind = ref<KindFilter>('ALL')
const expanded = ref<string[]>([])
const selectedKey = ref<string | null>(null)
/** Incident ouvert par lien alors qu'il n'est pas dans la file chargée (traité, ancien, hors page). */
const pinned = ref<Incident | null>(null)
const openError = ref<string | null>(null)
const busy = ref(false)
const decisionError = ref<string | null>(null)
const doneMessage = ref('')
const decisionPanel = ref<InstanceType<typeof IncidentDecisionPanel> | null>(null)
let ready = false

const route = useRoute()
const router = useRouter()
const queryValue = (name: string) => {
  const v = route.query?.[name]
  return typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : undefined
}
const KIND_OF_TAB: Record<string, KindFilter> = { disputes: 'DISPUTE', noshows: 'NOSHOW' }
/** Dernière query écrite par l'écran lui-même : son écho ne doit pas rouvrir ni refiltrer la file. */
let lastWritten = ''
const queryKey = (tabValue: string | undefined, open: string | undefined) => `${tabValue ?? ''}|${open ?? ''}`

/** `?open=` (+ `tab=noshows` pour une absence) et `tab=disputes|noshows` quand la file est filtrée. */
function writeUrl() {
  const s = selected.value
  const urlTab = s?.kind === 'NOSHOW' ? 'noshows' : kind.value === 'DISPUTE' ? 'disputes' : kind.value === 'NOSHOW' ? 'noshows' : undefined
  const open = s?.id
  if (urlTab === queryValue('tab') && open === queryValue('open')) return
  lastWritten = queryKey(urlTab, open)
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) if (k !== 'tab' && k !== 'open' && typeof v === 'string') q[k] = v
  if (urlTab) q.tab = urlTab
  if (open) q.open = open
  void router.replace({ query: q })
}

// ---- File ----
const now = ref(Date.now())
const visible = computed(() => filterIncidents(incidents.value, { query: query.value, kind: kind.value }))
const groups = computed(() => groupIncidents(visible.value, now.value))
const order = computed(() => queueOrder(groups.value))
const summary = computed(() => summarizeIncidents(todo.value, now.value))
const selected = computed<Incident | null>(() => {
  const key = selectedKey.value
  if (!key) return null
  return incidents.value.find((i) => i.key === key) ?? (pinned.value?.key === key ? pinned.value : null)
})
const hasNext = computed(() => followingIncidentKey(order.value, selectedKey.value) !== null)
const fiche = computed(() => (selected.value?.dispute && detail.dispute.value?.id === selected.value.id ? detail.dispute.value : null))

function resetFeedback() {
  decisionError.value = null
  doneMessage.value = ''
}
function scrollTo(key: string) {
  void nextTick(() => document.querySelector(`[data-test="incident-row-${CSS.escape(key)}"]`)?.scrollIntoView?.({ block: 'nearest' }))
}
/** Choix de l'admin (clic ou J / K) : le résultat du geste précédent n'a plus d'objet. */
function selectIncident(key: string) {
  if (key === selectedKey.value) return
  resetFeedback()
  openError.value = null
  selectedKey.value = key
  writeUrl()
  scrollTo(key)
}
function toggleGroup(key: string) {
  if (expanded.value.includes(key)) { expanded.value = expanded.value.filter((k) => k !== key); return }
  expanded.value = [...expanded.value, key]
  const first = groups.value.find((g) => g.key === key)?.incidents[0]
  if (first) selectIncident(first.key)
}

// Le dossier d'un litige se lit à la sélection ; celui d'une absence est déjà dans la file.
watch(selectedKey, async (key) => {
  void ctx.load(key)
  const s = key ? selected.value : null
  if (s?.dispute) { if (detail.dispute.value?.id !== s.id) await detail.open(s.id) }
  else detail.close()
})

// Un incident est toujours ouvert quand la file en contient un : au chargement, après un filtre, ou
// quand celui qui l'était a disparu. Un incident ouvert par lien hors file reste.
watch(order, (list) => {
  if (!ready) return
  if (selectedKey.value && (pinned.value?.key === selectedKey.value || list.some((i) => i.key === selectedKey.value))) return
  selectedKey.value = defaultIncidentKey(list)
})

// ---- Filtres ----
const TABS: { value: TabFilter; label: string }[] = [
  { value: 'TODO', label: 'À traiter' },
  { value: 'DONE', label: 'Traités' },
  { value: 'ALL', label: 'Tous' },
]
const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'DISPUTE', label: 'Litiges' },
  { value: 'NOSHOW', label: 'Absences' },
]
async function changeTab(t: TabFilter) { resetFeedback(); await setTab(t) }
function changeKind(k: KindFilter) { kind.value = k; writeUrl() }
const chip = (on: boolean) => ['rounded-full px-3 py-1 text-sm transition-colors',
  on ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']
const kindChip = (on: boolean) => ['rounded-full border px-2.5 py-0.5 text-xs transition-colors',
  on ? 'border-primary font-medium text-primary' : 'border-border text-text-muted hover:text-text']

// ---- Décision ----
interface Outcome { ok: boolean; message: string }
/**
 * Lance un geste. Le suivant se lit AVANT : un incident traité quitte l'onglet « À traiter ». Après
 * le geste la file est relue, puis le suivant (à défaut le même, à défaut le premier) s'ouvre.
 */
async function runDecision(run: () => Promise<Outcome>, { reload }: { reload: boolean }) {
  const s = selected.value
  if (!s) return
  const next = followingIncidentKey(order.value, s.key)
  busy.value = true
  resetFeedback()
  const outcome = await run()
  if (!outcome.ok) { busy.value = false; decisionError.value = outcome.message; return }
  if (reload) await fetch()
  busy.value = false
  doneMessage.value = outcome.message
  const list = order.value
  const target = next && list.some((i) => i.key === next) ? next : list.some((i) => i.key === s.key) ? s.key : defaultIncidentKey(list)
  selectedKey.value = target
  writeUrl()
  if (target) scrollTo(target)
  // Même dossier : sa chronologie doit montrer le geste.
  if (target === s.key) void ctx.load(s.key)
}
/** Les actions du composable de litige ne lèvent pas : leur échec se lit dans `error`. */
const fromDetail = (message: string): Outcome => (detail.error.value ? { ok: false, message: detail.error.value } : { ok: true, message })

async function onResolve(resolution: DisputeResolution, note: string) {
  await runDecision(async () => { await detail.resolve(resolution, note); return fromDetail('Litige résolu.') }, { reload: true })
}
async function onSplit(sender: number, traveler: number, note: string) {
  await runDecision(async () => { await detail.resolveWithSplit(sender, traveler, note); return fromDetail('Litige résolu : séquestre partagé.') }, { reload: true })
}
async function onGuarantee(cents: number, beneficiary: string, reason: string) {
  await runDecision(async () => {
    await detail.payGuarantee(cents, beneficiary, reason, detail.dispute.value?.bidCurrency)
    return fromDetail('Fonds de garantie versé.')
  }, { reload: true })
}
async function onRetrySplit() {
  busy.value = true
  resetFeedback()
  await detail.retrySplit()
  busy.value = false
  if (detail.error.value) decisionError.value = detail.error.value
  else {
    doneMessage.value = 'Partage repris.'
    void ctx.load(selectedKey.value)
  }
}
async function onDecideNoShow(decision: NoShowDecision, reason: string) {
  const row = selected.value?.noshow
  if (!row) return
  await runDecision(async () => {
    const res = await noshowDecision.decide(row, decision, reason)
    return { ok: res.ok, message: res.message }
  }, { reload: false })
}

/** Un autre incident (litige lié, autre incident des parties), ouvert depuis le dossier : dans la file, sinon lu. */
async function openOther(key: string) {
  resetFeedback()
  if (incidents.value.some((i) => i.key === key)) { selectIncident(key); return }
  const sep = key.indexOf(':')
  await openFromQuery(key.slice(sep + 1), key.slice(0, sep) === 'noshow' ? 'NOSHOW' : 'DISPUTE')
  writeUrl()
}

// ---- Raccourcis : J / K, 1 à 9, ⏎ ----
useWorkbenchShortcuts({
  enabled: () => true,
  move: (step) => {
    const key = neighbourIncidentKey(order.value, selectedKey.value, step)
    if (key) selectIncident(key)
  },
  pick: (n) => decisionPanel.value?.pick(n),
  confirm: () => decisionPanel.value?.submit(),
})

// ---- Lien profond ----
/** Ouvre un incident par identifiant : dans la file, sinon lu (litige) ou cherché parmi les absences chargées. */
async function openFromQuery(id: string | undefined, as: 'DISPUTE' | 'NOSHOW' | null = null) {
  openError.value = null
  if (!id) { pinned.value = null; return }
  const wantNoShow = (as ?? (queryValue('tab') === 'noshows' ? 'NOSHOW' : 'DISPUTE')) === 'NOSHOW'
  const key = wantNoShow ? noShowKey(id) : disputeKey(id)
  if (incidents.value.some((i) => i.key === key)) { pinned.value = null; selectedKey.value = key; return }
  if (wantNoShow) {
    const row = noshows.value.find((r) => r.id === id)
    if (!row) { openError.value = 'Déclaration introuvable dans la liste : elle a peut-être été tranchée, utilisez les filtres.'; return }
    pinned.value = noShowIncident(row)
    selectedKey.value = key
    return
  }
  await detail.open(id)
  // Un échec laisse la fiche précédente en mémoire : seule celle du litige demandé compte.
  if (detail.dispute.value?.id !== id) {
    openError.value = detail.error.value ?? 'Litige introuvable'
    // Le message vaut pour le lien, pas pour le dossier encore ouvert à côté.
    detail.error.value = null
    return
  }
  pinned.value = disputeIncident(detail.dispute.value)
  selectedKey.value = key
}

onMounted(async () => {
  kind.value = KIND_OF_TAB[queryValue('tab') ?? ''] ?? 'ALL'
  await fetch()
  ready = true
  await openFromQuery(queryValue('open'))
  if (!selectedKey.value) selectedKey.value = defaultIncidentKey(order.value)
})
// Page déjà ouverte : un lien (notification, colis, paiement) change seulement la query.
// Une fois la page quittée, plus rien n'est lu.
const onThisPage = () => /^\/incidents\/?$/.test(route.path ?? '')
watch(() => (onThisPage() ? [queryValue('tab'), queryValue('open')] as const : null), async (q) => {
  if (!q) return
  const [t, open] = q
  if (queryKey(t, open) === lastWritten) return
  const nextKind = KIND_OF_TAB[t ?? ''] ?? kind.value
  if (nextKind !== kind.value) kind.value = nextKind
  if (open && open !== selected.value?.id) await openFromQuery(open)
  else if (!open) openError.value = null
})
</script>

<template>
  <div data-test="incidents-workbench">
    <!-- Synthèse -->
    <section aria-label="Synthèse" class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-test="incident-summary">
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-text-muted">À traiter</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-todo">{{ summary.todo }}</span>
          <span class="text-xs text-text-muted">{{ summary.disputes }} litige{{ summary.disputes > 1 ? 's' : '' }} · {{ summary.noshows }} absence{{ summary.noshows > 1 ? 's' : '' }}</span>
        </span>
      </div>
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-danger">En retard</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-late">{{ summary.late }}</span>
          <span class="text-xs text-text-muted">plus de 7 jours ou délai échu</span>
        </span>
      </div>
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-warning">Remboursements gelés</span>
        <span class="flex flex-wrap items-baseline gap-x-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-frozen">{{ summary.frozen }}</span>
          <span v-if="summary.frozenAmounts.length" class="text-xs tabular-nums text-text-muted" data-test="summary-frozen-amounts">{{ summary.frozenAmounts.map((f) => formatMajorAmount(f.amount, f.currency)).join(' · ') }}</span>
        </span>
      </div>
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-text-muted">Échéance proche</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-urgent">{{ summary.urgent }}</span>
          <span class="text-xs text-text-muted">absences à trancher sous 2 h</span>
        </span>
      </div>
    </section>

    <p
      v-if="openError" data-test="incident-open-error" role="status"
      class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
    >{{ openError }}</p>
    <p
      v-if="warning" data-test="incidents-warning" role="status"
      class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
    >{{ warning }}</p>
    <p
      v-if="doneMessage" data-test="incidents-done" role="status"
      class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success text-pretty"
    >{{ doneMessage }}</p>

    <!-- Trois colonnes à toute largeur, comme les Alertes -->
    <div class="overflow-x-auto">
      <div class="grid min-w-[840px] grid-cols-[minmax(260px,1fr)_minmax(320px,1.7fr)_minmax(280px,1.05fr)] items-start gap-4">
        <!-- 1. File -->
        <section
          aria-label="File des incidents" data-test="incident-queue-panel"
          class="flex max-h-[calc(100vh-18rem)] min-h-[24rem] flex-col overflow-hidden rounded-card border border-border bg-surface"
        >
          <div class="flex flex-col gap-2 border-b border-border p-3">
            <div class="flex flex-wrap gap-1">
              <button
                v-for="t in TABS" :key="t.value" type="button" :data-test="`tab-${t.value}`"
                :aria-pressed="tab === t.value ? 'true' : 'false'" :class="chip(tab === t.value)"
                @click="changeTab(t.value)"
              >{{ t.label }}</button>
            </div>
            <input
              v-model="query" type="search" data-test="incident-search" aria-label="Rechercher un incident"
              placeholder="Rechercher : nom, colis, trajet…"
              class="w-full rounded-btn border border-border bg-bg px-3 py-1.5 text-sm"
            >
            <div class="flex flex-wrap gap-1" data-test="incident-kinds">
              <button
                v-for="k in KINDS" :key="k.value" type="button" :data-test="`kind-${k.value}`"
                :aria-pressed="kind === k.value ? 'true' : 'false'" :class="kindChip(kind === k.value)"
                @click="changeKind(k.value)"
              >{{ k.label }}</button>
            </div>
          </div>

          <IncidentQueue
            class="min-h-0 flex-1 overflow-hidden"
            :groups="groups" :loading="isLoading" :error="error" :selected-key="selectedKey" :expanded="expanded" :now="now"
            @select="selectIncident" @toggle="toggleGroup" @retry="fetch"
          />

          <div class="flex flex-col gap-2 border-t border-border bg-bg/50 p-3">
            <p v-if="truncated" data-test="incidents-truncated" class="text-xs text-text-muted text-pretty">Affichage limité aux 100 plus récents de chaque nature : la recherche porte sur ceux-ci.</p>
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span class="inline-flex items-center gap-1"><KeyHint>J</KeyHint><KeyHint>K</KeyHint> naviguer</span>
              <span class="inline-flex items-center gap-1"><KeyHint>⏎</KeyHint> confirmer</span>
            </p>
          </div>
        </section>

        <!-- 2. Dossier -->
        <div class="max-h-[calc(100vh-18rem)] min-h-[24rem] overflow-y-auto">
          <IncidentCase
            :incident="selected" :detail="fiche" :detail-loading="detail.isLoading.value" :detail-error="detail.error.value" :now="now"
            :context="ctx.context.value" :context-loading="ctx.isLoading.value" :context-error="ctx.error.value"
            @open-incident="openOther"
          />
        </div>

        <!-- 3. Décision -->
        <div class="sticky top-0">
          <IncidentDecisionPanel
            ref="decisionPanel"
            :incident="selected" :detail="fiche" :split-options="detail.splitOptions.value" :busy="busy" :error="decisionError" :has-next="hasNext"
            @resolve="onResolve" @split="onSplit" @guarantee="onGuarantee" @decide-noshow="onDecideNoShow" @retry-split="onRetrySplit"
          />
        </div>
      </div>
    </div>
  </div>
</template>
