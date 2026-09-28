<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import DisputesTable from '@/features/incidents/components/DisputesTable.vue'
import DisputeDetailPanel from '@/features/incidents/components/DisputeDetailPanel.vue'
import NoShowsTable from '@/features/incidents/components/NoShowsTable.vue'
import NoShowFilters from '@/features/incidents/components/NoShowFilters.vue'
import NoShowDetailPanel from '@/features/incidents/components/NoShowDetailPanel.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useDisputes } from '@/features/incidents/composables/useDisputes'
import { useDisputeDetail } from '@/features/incidents/composables/useDisputeDetail'
import { useNoShows, DISPUTE_REFRESH_MS } from '@/features/incidents/composables/useNoShows'
import type { AdminNoShow, NoShowDecision } from '@/features/incidents/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'DISPUTE_VIEW', pageTitle: 'Incidents', pageSubtitle: 'Litiges & no-shows' })

type Tab = 'disputes' | 'noshows'
const TABS: readonly Tab[] = ['disputes', 'noshows']
const isTab = (v: unknown): v is Tab => typeof v === 'string' && (TABS as readonly string[]).includes(v)
const asId = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

const route = useRoute()
const router = useRouter()
const tab = ref<Tab>('disputes')
const { disputes, isLoading, totalPages, currentPage, fetchDisputes, goToPage } = useDisputes()
const detail = useDisputeDetail()
const noshows = useNoShows()
let noshowsLoaded = false

async function afterAction() { await fetchDisputes() }
/**
 * L'onglet et la fiche ouverte vivent dans l'URL (?tab=noshows&open=<id>, ?tab=disputes&open=<id>) :
 * liens profonds des notifications et du badge « Litige ouvert » d'un no-show. Litiges = pas de `tab`.
 */
function syncQuery(t: Tab, open: string | null = null) {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) {
    if (k !== 'tab' && k !== 'open' && typeof v === 'string') query[k] = v
  }
  if (t !== 'disputes') query.tab = t
  if (open) query.open = open
  if (query.tab === route.query?.tab && query.open === route.query?.open) return
  void router.replace({ query })
}
async function loadNoShowsOnce() {
  if (noshowsLoaded) return
  noshowsLoaded = true
  await noshows.fetch()
}
async function switchTab(t: Tab, fromUrl = false) {
  tab.value = t
  // Une fiche ouverte dans l'autre onglet ne doit pas réapparaître au retour.
  if (t === 'disputes') noshows.close()
  else detail.close()
  if (!fromUrl) syncQuery(t)
  if (t === 'noshows') await loadNoShowsOnce()
}
/** Applique `?open=` à l'onglet courant ; les deux fiches ne se chargent que si elles changent. */
async function applyOpen(open: string | null) {
  if (!open) return
  if (tab.value === 'disputes') {
    if (detail.dispute.value?.id !== open) await detail.open(open)
    return
  }
  await loadNoShowsOnce()
  if (noshows.selected.value?.id !== open) await noshows.openById(open)
}

function selectNoShow(row: AdminNoShow) {
  noshows.select(row)
  syncQuery('noshows', row.id)
}
function closeNoShow() {
  noshows.close()
  syncQuery('noshows')
}
function closeDispute() {
  detail.close()
  if (route.query?.open) syncQuery('disputes')
}
async function decideNoShow(decision: NoShowDecision, reason: string) {
  const row = noshows.selected.value!
  const res = await noshows.decide(row, decision, reason)
  // Confirmer à l'arrivée ouvre un litige : la liste des litiges doit le montrer. Créé juste
  // après la réponse (`disputePending`), il n'est relu qu'un peu plus tard.
  if (res.ok && res.disputePending) setTimeout(() => { void fetchDisputes() }, DISPUTE_REFRESH_MS)
  else if (res.ok && decision === 'confirm' && row.scope === 'DELIVERY') await fetchDisputes()
  return res
}

onMounted(async () => {
  const wanted = route.query?.tab
  const initial: Tab = isTab(wanted) ? wanted : 'disputes'
  tab.value = initial
  await Promise.all([
    fetchDisputes(),
    initial === 'noshows' ? loadNoShowsOnce() : Promise.resolve(),
  ])
  await applyOpen(asId(route.query?.open))
})
// Page déjà ouverte : un clic sur une notification ou sur un badge de litige change seulement la query.
watch(() => [route.query?.tab, route.query?.open] as const, async ([t, open]) => {
  const next: Tab = isTab(t) ? t : 'disputes'
  if (next !== tab.value) await switchTab(next, true)
  await applyOpen(asId(open))
})
</script>

<template>
  <div>
    <div class="flex gap-1 mb-4">
      <button type="button" data-test="tab-disputes" :aria-pressed="tab === 'disputes'" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'disputes' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('disputes')">Litiges</button>
      <button type="button" data-test="tab-noshows" :aria-pressed="tab === 'noshows'" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'noshows' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('noshows')">No-shows</button>
    </div>

    <template v-if="tab === 'disputes'">
      <DisputesTable :disputes="disputes" :loading="isLoading" @select="detail.open" />
      <div class="mt-4"><PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" /></div>
      <DisputeDetailPanel
        v-if="detail.dispute.value"
        :dispute="detail.dispute.value" :open="detail.dispute.value !== null"
        @close="closeDispute"
        @resolve="async (r, n) => { await detail.resolve(r, n); await afterAction() }"
        @guarantee="async (c, b, r) => { await detail.payGuarantee(c, b, r, detail.dispute.value?.bidCurrency); await afterAction() }"
      />
    </template>

    <template v-else>
      <NoShowFilters
        :status="noshows.filters.status" :scope="noshows.filters.scope"
        @update:status="noshows.setStatus" @update:scope="noshows.setScope"
      />
      <p
        v-if="noshows.error.value" data-test="noshows-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ noshows.error.value }}</p>
      <p
        v-if="noshows.openError.value" data-test="noshows-open-error" role="status"
        class="mb-3 rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted"
      >{{ noshows.openError.value }}</p>
      <NoShowsTable :rows="noshows.rows.value" :loading="noshows.isLoading.value" @select="selectNoShow" />
      <div class="mt-4">
        <PaginationControls :page="noshows.currentPage.value" :total-pages="noshows.totalPages.value" @change="noshows.goToPage" />
      </div>
      <NoShowDetailPanel
        v-if="noshows.selected.value"
        :row="noshows.selected.value" :decide="decideNoShow"
        @close="closeNoShow"
      />
    </template>
  </div>
</template>
