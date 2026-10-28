<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import GpProQueue from './GpProQueue.vue'
import GpProScopeTabs from './GpProScopeTabs.vue'
import GpProApplicationCase from './GpProApplicationCase.vue'
import GpProDecisionPanel from './GpProDecisionPanel.vue'
import GpProReviewCase from './GpProReviewCase.vue'
import GpProReviewPanel from './GpProReviewPanel.vue'
import { gpProService } from '@/features/gp-pro/services/gpProService'
import { useGpProList } from '@/features/gp-pro/composables/useGpProList'
import { useGpProApplication } from '@/features/gp-pro/composables/useGpProApplication'
import { useGpProAction } from '@/features/gp-pro/composables/useGpProAction'
import { useWorkbenchShortcuts } from '@/features/signalements/composables/useWorkbenchShortcuts'
import {
  applicantName, neighbourKey, sortApplications, sortReview, summarizeGpPro,
} from '@/features/gp-pro/lib/gpProWorkbench'
import type { GpProScope } from '@/features/gp-pro/lib/gpProWorkbench'
import { GP_PRO_UNAVAILABLE } from '@/features/gp-pro/types/index'
import type { AdminGpProApplicationRow, AdminGpProReviewRow } from '@/features/gp-pro/types/index'
import { uuidParam } from '@/lib/safeInput'
import { useAuthStore } from '@/stores/auth'

/**
 * Poste GP Pro : la file (demandes à examiner ou titulaires à revoir, les plus anciens d'abord) à
 * gauche, le dossier au centre, la décision à droite. L'onglet et le dossier ouvert vivent dans
 * l'URL (`?tab=revue&open=<id>` : identifiant de la demande, ou du titulaire à revoir).
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const scope = ref<GpProScope>(route.query?.tab === 'revue' ? 'revue' : 'demandes')
const applications = useGpProList<AdminGpProApplicationRow>(
  (p, s) => gpProService.listApplications(p, s), 'Impossible de charger les demandes')
const review = useGpProList<AdminGpProReviewRow>(
  (p, s) => gpProService.listReview(p, s), 'Impossible de charger les titulaires à revoir')
const detail = useGpProApplication()
const dismissal = useGpProAction({ onStale: () => { void review.load() } })
const decisionPanel = ref<InstanceType<typeof GpProDecisionPanel> | null>(null)

const openId = ref<string | null>(null)
/** Instantané de la demande à l'ouverture : après une décision, la ligne quitte la file mais le nom reste. */
const openedApplication = ref<AdminGpProApplicationRow | null>(null)
const now = ref(Date.now())

const sortedApplications = computed(() => sortApplications(applications.items.value))
const sortedReview = computed(() => sortReview(review.items.value))
const applicationKeys = computed(() => sortedApplications.value.map((r) => r.applicationId))
const reviewKeys = computed(() => sortedReview.value.map((r) => r.userId))
const keys = computed(() => (scope.value === 'revue' ? reviewKeys.value : applicationKeys.value))
const list = computed(() => (scope.value === 'revue' ? review : applications))
const summary = computed(() => summarizeGpPro(applications.items.value, applications.totalElements.value, review.totalElements.value, now.value))

/** La fiche chargée appartient bien à la demande ouverte : jamais la réponse tardive d'une autre. */
const openDetail = computed(() => (detail.detail.value?.applicationId === openId.value ? detail.detail.value : null))
const openApplicationRow = computed(() =>
  applications.items.value.find((r) => r.applicationId === openId.value) ?? openedApplication.value)
const openReviewRow = computed(() => review.items.value.find((r) => r.userId === openId.value) ?? null)
const title = computed(() => openDetail.value?.displayName
  ?? (openApplicationRow.value ? applicantName(openApplicationRow.value) : `Demande ${(openId.value ?? '').slice(0, 8)}`))

// ---- URL ----
const queryValue = (name: string) => {
  const v = route.query?.[name]
  return typeof v === 'string' && v ? v : null
}
/** Les identifiants de l'URL deviennent des segments d'appel d'API : seul un UUID valide est suivi. */
const openParam = () => uuidParam(queryValue('open'))
/** Dernière valeur de `open` écrite par l'écran : son écho ne doit pas rouvrir le dossier. */
let lastWritten: string | null = null
function syncQuery() {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) {
    if (k !== 'tab' && k !== 'open' && typeof v === 'string') query[k] = v
  }
  if (scope.value === 'revue') query.tab = 'revue'
  if (openId.value) query.open = openId.value
  lastWritten = openId.value
  void router.replace({ query })
}

// ---- Ouverture ----
function scrollTo(id: string) {
  void nextTick(() => document.querySelector(`[data-test="open-${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: 'nearest' }))
}
async function open(id: string, { write = true }: { write?: boolean } = {}) {
  openId.value = id
  if (scope.value === 'demandes') {
    openedApplication.value = applications.items.value.find((r) => r.applicationId === id) ?? null
    if (write) syncQuery()
    await detail.load(id)
    return
  }
  openedApplication.value = null
  detail.clear()
  if (write) syncQuery()
}
function select(id: string) {
  if (id === openId.value) return
  void open(id)
  scrollTo(id)
}
function clearOpen() {
  openId.value = null
  openedApplication.value = null
  detail.clear()
}
async function openFirst() {
  const first = keys.value[0]
  if (first) await open(first, { write: false })
  else clearOpen()
}

async function setScope(next: GpProScope) {
  if (next === scope.value) return
  scope.value = next
  clearOpen()
  await (next === 'revue' ? review.load(0) : applications.load(0))
  await openFirst()
  syncQuery()
}
/** Une autre page de la file : le premier dossier de cette page s'ouvre. */
async function goToPage(page: number) {
  clearOpen()
  await list.value.goToPage(page)
  await openFirst()
}

// ---- Gestes ----
async function refreshAfterDecision() {
  const id = openId.value
  await Promise.all([id ? detail.refresh(id) : Promise.resolve(), applications.load()])
}
async function dismiss(flagId: string) {
  if (!(await dismissal.run(() => gpProService.dismissFlag(flagId), 'L’alerte n’a pas pu être écartée'))) return
  await review.load()
  // La dernière alerte écartée sort le titulaire de la file : on passe au suivant.
  if (openId.value && !review.items.value.some((r) => r.userId === openId.value)) await openFirst()
}

useWorkbenchShortcuts({
  enabled: () => !(decisionPanel.value?.dialogOpen() ?? false),
  move: (step) => {
    const id = neighbourKey(keys.value, openId.value, step)
    if (id) select(id)
  },
  pick: () => {},
  confirm: () => {},
  keys: {
    a: () => decisionPanel.value?.startDecision('approve'),
    r: () => decisionPanel.value?.startDecision('reject'),
  },
})

onMounted(async () => {
  const deepLink = openParam()
  // Les deux files se lisent : l'onglet inactif affiche tout de même son nombre.
  await Promise.all([applications.load(0), review.load(0)])
  if (deepLink) await open(deepLink, { write: false })
  else await openFirst()
})
// Page déjà ouverte : un clic sur une notification change seulement la query.
watch(openParam, (v) => {
  if (v === lastWritten) return
  if (v && v !== openId.value) void open(v, { write: false })
})
watch(() => queryValue('tab'), async (v) => {
  const next: GpProScope = v === 'revue' ? 'revue' : 'demandes'
  if (next === scope.value) return
  scope.value = next
  clearOpen()
  await (next === 'revue' ? review.load(0) : applications.load(0))
  const deepLink = openParam()
  if (deepLink) await open(deepLink, { write: false })
  else await openFirst()
})

const unavailable = computed(() => list.value.unavailable.value)
</script>

<template>
  <div data-test="gp-pro-workbench">
    <!-- Synthèse -->
    <section aria-label="Synthèse" class="mb-4 grid grid-cols-3 gap-3" data-test="gp-pro-summary">
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-text-muted">Demandes à examiner</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-applications">{{ summary.applications }}</span>
          <span class="text-xs text-text-muted">badge GP Pro demandé</span>
        </span>
      </div>
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-text-muted">Plus ancienne demande</span>
        <span v-if="summary.oldest" class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-oldest">{{ summary.oldest.label }}</span>
          <span class="min-w-0 truncate text-xs text-text-muted">{{ summary.oldest.name }}</span>
        </span>
        <span v-else class="font-display text-3xl font-bold" data-test="summary-oldest">0</span>
      </div>
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-text-muted">Titulaires à revoir</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-review">{{ summary.review }}</span>
          <span class="text-xs text-text-muted">alertes automatiques ouvertes</span>
        </span>
      </div>
    </section>

    <template v-if="unavailable">
      <GpProScopeTabs class="mb-3" :scope="scope" :applications="applications.totalElements.value" :review="review.totalElements.value" @select="setScope" />
      <p
        :data-test="scope === 'revue' ? 'gp-pro-review-unavailable' : 'gp-pro-unavailable'"
        class="rounded-card border border-border bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted"
      >{{ GP_PRO_UNAVAILABLE }}</p>
    </template>

    <div v-else class="overflow-x-auto">
      <div class="grid min-w-[840px] grid-cols-[minmax(280px,1fr)_minmax(340px,1.9fr)_minmax(260px,0.95fr)] items-start gap-4">
        <!-- 1. File -->
        <section
          aria-label="File GP Pro" data-test="gp-pro-queue-panel"
          class="flex max-h-[calc(100vh-18rem)] min-h-[24rem] flex-col overflow-hidden rounded-card border border-border bg-surface"
        >
          <div class="flex flex-col gap-2 border-b border-border p-3">
            <GpProScopeTabs :scope="scope" :applications="applications.totalElements.value" :review="review.totalElements.value" @select="setScope" />
            <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Les plus anciens d’abord</p>
          </div>

          <GpProQueue
            class="min-h-0 flex-1 overflow-hidden"
            :scope="scope" :applications="sortedApplications" :review="sortedReview"
            :loading="list.isLoading.value" :error="list.error.value" :selected-id="openId" :now="now"
            @select="select" @retry="list.load()"
          />

          <div class="flex flex-col gap-2 border-t border-border bg-bg/50 p-3">
            <PaginationControls :page="list.currentPage.value" :total-pages="list.totalPages.value" @change="goToPage" />
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span class="inline-flex items-center gap-1"><KeyHint>J</KeyHint><KeyHint>K</KeyHint> naviguer</span>
              <template v-if="scope === 'demandes'">
                <span class="inline-flex items-center gap-1"><KeyHint>A</KeyHint> accepter</span>
                <span class="inline-flex items-center gap-1"><KeyHint>R</KeyHint> refuser</span>
              </template>
            </p>
          </div>
        </section>

        <!-- 2 et 3. Dossier et décision -->
        <template v-if="scope === 'demandes'">
          <p
            v-if="!openId" data-test="gp-pro-case-empty"
            class="rounded-card border border-border bg-surface px-5 py-16 text-center text-sm text-text-muted"
          >Choisissez une demande dans la file.</p>
          <GpProApplicationCase
            v-else
            :row="openApplicationRow" :application-id="openId" :detail="openDetail"
            :loading="detail.isLoading.value" :error="detail.error.value" :now="now"
            @refresh="() => openId && detail.refresh(openId)"
          />
          <GpProDecisionPanel
            v-if="openId && openDetail" ref="decisionPanel"
            :application-id="openDetail.applicationId" :detail="openDetail" :title="title"
            @decided="refreshAfterDecision" @stale="refreshAfterDecision"
          />
          <div v-else />
        </template>

        <template v-else>
          <p
            v-if="!openId" data-test="gp-pro-case-empty"
            class="rounded-card border border-border bg-surface px-5 py-16 text-center text-sm text-text-muted"
          >Choisissez un titulaire dans la file.</p>
          <GpProReviewCase
            v-else
            :row="openReviewRow" :user-id="openId"
            :can-dismiss="auth.can('GP_PRO_REVIEW') && !dismissal.unavailable.value"
            :busy="dismissal.busy.value" :error="dismissal.error.value" :now="now"
            @dismiss="dismiss"
          />
          <GpProReviewPanel v-if="openId" :row="openReviewRow" :user-id="openId" />
          <div v-else />
        </template>
      </div>
    </div>
  </div>
</template>
