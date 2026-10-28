<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import KycQueueFilters from './KycQueueFilters.vue'
import KycQueue from './KycQueue.vue'
import KycCase from './KycCase.vue'
import KycDecisionActions from './KycDecisionActions.vue'
import { useKycQueue } from '@/features/kyc/composables/useKycQueue'
import { useUserKyc } from '@/features/users/composables/useUserKyc'
import { useWorkbenchShortcuts } from '@/features/signalements/composables/useWorkbenchShortcuts'
import {
  defaultKycUserId, groupKycQueue, kycQueueOrder, neighbourKycUserId, summarizeKycQueue,
} from '@/features/kyc/lib/kycWorkbench'
import { KYC_QUEUE_UNAVAILABLE, isKycQueueStatus } from '@/features/kyc/types/index'
import type { AdminKycQueueItem, KycQueueStatus } from '@/features/kyc/types/index'
import type { AdminKycDetail } from '@/features/users/types/index'

/**
 * Poste KYC : la file (en retard d'abord) à gauche, le dossier au centre, la décision à droite.
 * Le statut filtré et le dossier ouvert vivent dans l'URL (`?status=REJECTED&open=<id>`) : liens
 * profonds, dont celui des notifications KYC_IN_REVIEW.
 */
const route = useRoute()
const router = useRouter()
const wanted = route.query?.status
const queue = useKycQueue(isKycQueueStatus(wanted) ? wanted : 'IN_REVIEW')
const detail = useUserKyc()
const actions = ref<InstanceType<typeof KycDecisionActions> | null>(null)

const openId = ref<string | null>(null)
// Instantané pris à l'ouverture : après une décision, la ligne peut quitter la file filtrée,
// mais le dossier doit garder le nom (en-tête et ressaisie avant révocation).
const openedRow = ref<AdminKycQueueItem | null>(null)
const openRow = computed(() => queue.items.value.find((r) => r.userId === openId.value) ?? openedRow.value)
let ready = false

const groups = computed(() => groupKycQueue(queue.items.value, queue.filters.status))
const order = computed(() => kycQueueOrder(groups.value))
const summary = computed(() => summarizeKycQueue(queue.items.value, queue.totalElements.value))
const showSummary = computed(() => queue.filters.status === 'IN_REVIEW')

/** Dernière valeur de `open` écrite par l'écran : son écho ne doit pas rouvrir le dossier. */
let lastWritten: string | null = null
const queryValue = (name: string) => {
  const v = route.query?.[name]
  return typeof v === 'string' && v ? v : null
}
function syncQuery() {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) {
    if (k !== 'status' && k !== 'open' && typeof v === 'string') query[k] = v
  }
  if (queue.filters.status !== 'IN_REVIEW') query.status = queue.filters.status
  if (openId.value) query.open = openId.value
  lastWritten = openId.value
  void router.replace({ query })
}

function scrollTo(id: string) {
  void nextTick(() => document.querySelector(`[data-test="kyc-row-${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: 'nearest' }))
}
async function open(userId: string, { write = true }: { write?: boolean } = {}) {
  openId.value = userId
  openedRow.value = queue.items.value.find((r) => r.userId === userId) ?? null
  if (write) syncQuery()
  await detail.load(userId)
}
function select(userId: string) {
  if (userId === openId.value) return
  void open(userId)
  scrollTo(userId)
}
async function setStatus(s: KycQueueStatus) {
  openId.value = null
  openedRow.value = null
  await queue.setStatus(s)
  const first = defaultKycUserId(order.value)
  if (first && !openId.value) await open(first, { write: false })
  syncQuery()
}
// Une recherche, un filtre ou une page qui vide le dossier ouvert : on ouvre le premier de la file.
watch(order, (list) => {
  if (!ready || queue.isLoading.value || openId.value) return
  const first = defaultKycUserId(list)
  if (first) void open(first, { write: false })
})

async function onDecided(updated: AdminKycDetail) {
  detail.set(updated)
  // La ligne peut quitter la file filtrée (une identité validée n'est plus « en attente »).
  await queue.load()
}
async function onStale() {
  if (!openId.value) return
  await Promise.all([detail.refresh(openId.value), queue.load()])
}
async function onReset(reason: string) {
  if (!openId.value) return
  await detail.reset(openId.value, reason)
  await queue.load()
}

useWorkbenchShortcuts({
  enabled: () => !(actions.value?.dialogOpen() ?? false),
  move: (step) => {
    const id = neighbourKycUserId(order.value, openId.value, step)
    if (id) select(id)
  },
  pick: () => {},
  confirm: () => {},
  keys: {
    v: () => actions.value?.startDecision('approve'),
    r: () => actions.value?.startDecision('reject'),
  },
})

onMounted(async () => {
  const deepLink = queryValue('open')
  await queue.load(0)
  ready = true
  if (deepLink) await open(deepLink, { write: false })
  else {
    const first = defaultKycUserId(order.value)
    if (first) await open(first, { write: false })
  }
})
// Page déjà ouverte : un clic sur une notification KYC_IN_REVIEW ne remonte pas le composant.
watch(() => queryValue('open'), (v) => {
  if (v === lastWritten) return
  if (v && v !== openId.value) void open(v, { write: false })
})
</script>

<template>
  <div data-test="kyc-workbench">
    <p
      v-if="queue.unavailable.value" data-test="kyc-unavailable"
      class="rounded-card border border-border bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted"
    >{{ KYC_QUEUE_UNAVAILABLE }}</p>

    <template v-else>
      <!-- Synthèse -->
      <section v-if="showSummary" aria-label="Synthèse" class="mb-4 grid grid-cols-3 gap-3" data-test="kyc-summary">
        <div class="rounded-card border border-border bg-surface p-3">
          <span class="block text-xs font-semibold uppercase tracking-wide text-text-muted">En attente de décision</span>
          <span class="flex items-baseline gap-2">
            <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-total">{{ summary.total }}</span>
            <span class="text-xs text-text-muted">identité{{ summary.total > 1 ? 's' : '' }} à examiner</span>
          </span>
        </div>
        <div class="rounded-card border border-border bg-surface p-3">
          <span class="block text-xs font-semibold uppercase tracking-wide text-danger">En retard (plus de 48 h)</span>
          <span class="flex items-baseline gap-2">
            <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-overdue">{{ summary.overdue }}</span>
            <span class="text-xs text-text-muted">{{ summary.partial ? 'sur la page affichée' : 'à traiter en premier' }}</span>
          </span>
        </div>
        <div class="rounded-card border border-border bg-surface p-3">
          <span class="block text-xs font-semibold uppercase tracking-wide text-text-muted">Attente la plus longue</span>
          <span v-if="summary.longest" class="flex items-baseline gap-2">
            <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-longest">{{ summary.longest.label }}</span>
            <span class="min-w-0 truncate text-xs text-text-muted">{{ summary.longest.name }}</span>
          </span>
          <span v-else class="font-display text-3xl font-bold" data-test="summary-longest">—</span>
        </div>
      </section>

      <div class="overflow-x-auto">
        <div class="grid min-w-[840px] grid-cols-[minmax(280px,1fr)_minmax(340px,1.9fr)_minmax(260px,0.95fr)] items-start gap-4">
          <!-- 1. File -->
          <section
            aria-label="File des vérifications" data-test="kyc-queue-panel"
            class="flex max-h-[calc(100vh-18rem)] min-h-[24rem] flex-col overflow-hidden rounded-card border border-border bg-surface"
          >
            <KycQueueFilters
              :filters="queue.filters"
              @update:status="setStatus"
              @update:provider="queue.setProvider"
              @update:query="queue.setQuery"
              @update:date-range="(from, to) => queue.setDateRange(from, to)"
            />
            <KycQueue
              class="min-h-0 flex-1 overflow-hidden"
              :groups="groups" :loading="queue.isLoading.value" :error="queue.error.value" :selected-id="openId"
              @select="select" @retry="queue.load()"
            />
            <div class="flex flex-col gap-2 border-t border-border bg-bg/50 p-3">
              <p data-test="kyc-total" class="text-xs tabular-nums text-text-muted">
                {{ queue.totalElements.value }} vérification{{ queue.totalElements.value > 1 ? 's' : '' }}
              </p>
              <PaginationControls :page="queue.currentPage.value" :total-pages="queue.totalPages.value" @change="queue.goToPage" />
              <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                <span class="inline-flex items-center gap-1"><KeyHint>J</KeyHint><KeyHint>K</KeyHint> naviguer</span>
                <span class="inline-flex items-center gap-1"><KeyHint>V</KeyHint> valider</span>
                <span class="inline-flex items-center gap-1"><KeyHint>R</KeyHint> refuser</span>
              </p>
            </div>
          </section>

          <!-- 2. Dossier -->
          <KycCase
            :row="openRow" :user-id="openId ?? ''" :kyc="detail.kyc.value" :loading="detail.isLoading.value" :error="detail.error.value"
          />

          <!-- 3. Décision -->
          <aside aria-label="Décision" class="flex min-w-0 flex-col gap-3" data-test="kyc-decision-panel">
            <p
              v-if="detail.kyc.value && detail.error.value" data-test="kyc-reset-error" role="alert"
              class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >{{ detail.error.value }}</p>
            <KycDecisionActions
              v-if="detail.kyc.value && openId" ref="actions"
              :kyc="detail.kyc.value" :user-name="openRow?.userName ?? null" :reset-busy="detail.busy.value"
              @decided="onDecided" @stale="onStale" @reset="onReset"
            />
            <section
              v-if="openId" data-test="kyc-account" class="rounded-card border border-border bg-surface p-4"
            >
              <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Compte</h3>
              <p v-if="openRow?.userName" class="mt-1 text-sm font-semibold">{{ openRow.userName }}</p>
              <p v-if="openRow?.userPhone" class="text-sm tabular-nums text-text-muted">{{ openRow.userPhone }}</p>
              <NuxtLink
                :to="`/users?open=${openId}`" data-test="kyc-user-link"
                class="mt-2 inline-block text-sm text-primary underline-offset-2 hover:underline"
              >Ouvrir la fiche utilisateur ›</NuxtLink>
            </section>
          </aside>
        </div>
      </div>
    </template>
  </div>
</template>
