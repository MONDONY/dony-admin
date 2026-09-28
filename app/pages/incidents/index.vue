<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import DisputesTable from '@/features/incidents/components/DisputesTable.vue'
import DisputeDetailPanel from '@/features/incidents/components/DisputeDetailPanel.vue'
import NoShowsTable from '@/features/incidents/components/NoShowsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useDisputes } from '@/features/incidents/composables/useDisputes'
import { useDisputeDetail } from '@/features/incidents/composables/useDisputeDetail'
import { useNoShows } from '@/features/incidents/composables/useNoShows'

definePageMeta({ middleware: 'admin-only', permission: 'DISPUTE_VIEW', pageTitle: 'Incidents', pageSubtitle: 'Litiges & no-shows' })

type Tab = 'disputes' | 'noshows'
const TABS: readonly Tab[] = ['disputes', 'noshows']
const isTab = (v: unknown): v is Tab => typeof v === 'string' && (TABS as readonly string[]).includes(v)

const route = useRoute()
const router = useRouter()
const tab = ref<Tab>('disputes')
const { disputes, isLoading, totalPages, currentPage, fetchDisputes, goToPage } = useDisputes()
const detail = useDisputeDetail()
const noshows = useNoShows()

async function afterAction() { await fetchDisputes() }
/** L'onglet vit dans l'URL (?tab=noshows) : liens profonds des notifications. Litiges = pas de paramètre. */
function syncTabQuery(t: Tab) {
  const query = { ...(route.query ?? {}) }
  if (t === 'disputes') delete query.tab
  else query.tab = t
  if (query.tab === route.query?.tab) return
  void router.replace({ query })
}
async function switchTab(t: Tab, fromUrl = false) {
  tab.value = t
  if (!fromUrl) syncTabQuery(t)
  if (t === 'noshows' && noshows.cancellations.value.length === 0) await noshows.fetchCancellations()
}

onMounted(async () => {
  const wanted = route.query?.tab
  await Promise.all([fetchDisputes(), isTab(wanted) && wanted !== 'disputes' ? switchTab(wanted, true) : Promise.resolve()])
})
// Page déjà ouverte : un clic sur une notification change seulement la query.
watch(() => route.query?.tab, (v) => {
  const t: Tab = isTab(v) ? v : 'disputes'
  if (t !== tab.value) void switchTab(t, true)
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
        @close="detail.close"
        @resolve="async (r, n) => { await detail.resolve(r, n); await afterAction() }"
        @guarantee="async (c, b, r) => { await detail.payGuarantee(c, b, r, detail.dispute.value?.bidCurrency); await afterAction() }"
      />
    </template>

    <template v-else>
      <p
        v-if="noshows.error.value" data-test="noshows-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ noshows.error.value }}</p>
      <NoShowsTable :cancellations="noshows.cancellations.value" :loading="noshows.isLoading.value"
        @confirm="async (bidId) => { await noshows.confirm(bidId) }" />
      <div class="mt-4">
        <PaginationControls :page="noshows.currentPage.value" :total-pages="noshows.totalPages.value" @change="noshows.goToPage" />
      </div>
    </template>
  </div>
</template>
