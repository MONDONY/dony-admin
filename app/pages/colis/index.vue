<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BidsTable from '@/features/bids/components/BidsTable.vue'
import BidFilters from '@/features/bids/components/BidFilters.vue'
import BidDetailPanel from '@/features/bids/components/BidDetailPanel.vue'
import AnnouncementsTable from '@/features/bids/components/AnnouncementsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useAdminBids } from '@/features/bids/composables/useAdminBids'
import { useBidTimeline } from '@/features/bids/composables/useBidTimeline'
import { useAdminAnnouncements } from '@/features/bids/composables/useAdminAnnouncements'
import PackageRequestFilters from '@/features/package-requests/components/PackageRequestFilters.vue'
import PackageRequestsTable from '@/features/package-requests/components/PackageRequestsTable.vue'
import PackageRequestDetailPanel from '@/features/package-requests/components/PackageRequestDetailPanel.vue'
import { usePackageRequests } from '@/features/package-requests/composables/usePackageRequests'
import { usePackageRequestDetail, PACKAGE_REQUESTS_UNAVAILABLE } from '@/features/package-requests/composables/usePackageRequestDetail'
import { useAuthStore } from '@/stores/auth'

definePageMeta({ middleware: 'admin-only', permission: 'BID_VIEW', pageTitle: 'Colis', pageSubtitle: 'Bids, annonces & demandes d’envoi' })

type Tab = 'bids' | 'announcements' | 'demandes'
const TABS: readonly Tab[] = ['bids', 'announcements', 'demandes']

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const tab = ref<Tab>('bids')
// Évalué au montage : la session n'existe pas au rendu serveur, un `v-if` direct sur
// `auth.can()` ferait diverger l'hydratation.
const canSeeRequests = ref(false)
const { bids, isLoading, totalPages, currentPage, filters, fetchBids, goToPage, setStatusFilter, setSearch, setDateRange } = useAdminBids()
const detail = useBidTimeline()
const {
  announcements: anns, isLoading: annLoading, error: annError, busy: annBusy,
  currentPage: annPage, totalPages: annTotalPages,
  load: loadAnns, goToPage: goToAnnPage, remove: removeAnnouncement, restore: restoreAnnouncement,
} = useAdminAnnouncements()

// ---- Demandes d'envoi ----
const pr = usePackageRequests()
const prDetail = usePackageRequestDetail()
let prLoaded = false
let bidsLoaded = false
async function loadBidsOnce() {
  if (bidsLoaded) return
  bidsLoaded = true
  await fetchBids()
}

/** L'onglet et la fiche ouverte vivent dans l'URL (?tab=demandes&open=<id>) : liens profonds. */
function syncQuery(next: { tab: Tab; open?: string | null }) {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) {
    if (k !== 'tab' && k !== 'open' && typeof v === 'string') query[k] = v
  }
  if (next.tab !== 'bids') query.tab = next.tab
  if (next.open) query.open = next.open
  router.replace({ query })
}

async function switchTab(t: Tab) {
  tab.value = t
  if (t !== 'demandes') prDetail.close()
  syncQuery({ tab: t })
  if (t === 'bids') await loadBidsOnce()
  if (t === 'announcements' && anns.value.length === 0) {
    await loadAnns()
  }
  if (t === 'demandes' && !prLoaded) {
    prLoaded = true
    await pr.load()
  }
}

async function openRequest(id: string) {
  syncQuery({ tab: 'demandes', open: id })
  await prDetail.open(id)
}
function closeRequest() {
  prDetail.close()
  syncQuery({ tab: 'demandes' })
}
function afterAction() {
  // Succès comme conflit resynchronisé : la ligne reflète la fiche relue.
  if (prDetail.request.value) pr.replace(prDetail.request.value)
}
async function removeRequest(publicReason: string, internalNote: string) {
  await prDetail.remove(publicReason, internalNote)
  afterAction()
}
async function restoreRequest() {
  await prDetail.restore()
  afterAction()
}

onMounted(async () => {
  canSeeRequests.value = auth.can('BID_VIEW')
  const wanted = route.query?.tab
  const initial = typeof wanted === 'string' && (TABS as readonly string[]).includes(wanted) ? wanted as Tab : 'bids'
  if (initial === 'demandes' && canSeeRequests.value) {
    tab.value = 'demandes'
    prLoaded = true
    const openId = route.query?.open
    await Promise.all([
      pr.load(),
      typeof openId === 'string' && openId ? prDetail.open(openId) : Promise.resolve(),
    ])
    return
  }
  if (initial === 'announcements') {
    tab.value = 'announcements'
    await loadAnns()
    return
  }
  // ?open=<bidId> sur l'onglet Bids (lien « Ouvrir le colis » d'un no-show) : ouvre la fiche.
  const openBid = route.query?.open
  await Promise.all([
    loadBidsOnce(),
    typeof openBid === 'string' && openBid ? detail.open(openBid) : Promise.resolve(),
  ])
})
</script>

<template>
  <div>
    <div class="flex gap-1 mb-4">
      <button
        type="button" data-test="tab-bids"
        :class="['rounded-full px-3 py-1.5 text-sm', tab === 'bids' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']"
        @click="switchTab('bids')"
      >Bids</button>
      <button
        type="button" data-test="tab-announcements"
        :class="['rounded-full px-3 py-1.5 text-sm', tab === 'announcements' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']"
        @click="switchTab('announcements')"
      >Annonces</button>
      <button
        v-if="canSeeRequests"
        type="button" data-test="tab-demandes"
        :class="['rounded-full px-3 py-1.5 text-sm', tab === 'demandes' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']"
        @click="switchTab('demandes')"
      >Demandes</button>
    </div>

    <template v-if="tab === 'bids'">
      <BidFilters
        :model-status="filters.status"
        :model-query="filters.query"
        :model-date-from="filters.dateFrom"
        :model-date-to="filters.dateTo"
        @update:status="setStatusFilter"
        @update:query="setSearch"
        @update:date-range="(from, to) => setDateRange(from, to)"
      />
      <BidsTable :bids="bids" :loading="isLoading" @select="detail.open" />
      <div class="mt-4">
        <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
      </div>
      <BidDetailPanel
        v-if="detail.bid.value"
        :bid="detail.bid.value"
        :timeline="detail.timeline.value"
        :open="detail.bid.value !== null"
        @close="detail.close"
      />
    </template>

    <template v-else-if="tab === 'demandes'">
      <p
        v-if="pr.unavailable.value" data-test="pr-unavailable"
        class="rounded-card border border-border bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted"
      >{{ PACKAGE_REQUESTS_UNAVAILABLE }}</p>
      <template v-else>
        <PackageRequestFilters
          :filters="pr.filters"
          @update:status="pr.setStatus"
          @update:query="pr.setQuery"
          @update:reported-only="pr.setReportedOnly"
          @update:date-range="(from, to) => pr.setDateRange(from, to)"
        />
        <p
          v-if="pr.error.value" data-test="pr-error" role="alert"
          class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >{{ pr.error.value }}</p>
        <PackageRequestsTable :requests="pr.requests.value" :loading="pr.isLoading.value" @select="openRequest" />
        <div class="mt-4">
          <PaginationControls :page="pr.currentPage.value" :total-pages="pr.totalPages.value" @change="pr.goToPage" />
        </div>
      </template>

      <PackageRequestDetailPanel
        v-if="prDetail.request.value"
        :request="prDetail.request.value"
        :busy="prDetail.busy.value"
        :error="prDetail.actionError.value"
        :error-code="prDetail.actionErrorCode.value"
        @close="closeRequest" @remove="removeRequest" @restore="restoreRequest"
      />
      <div
        v-else-if="prDetail.openId.value && (prDetail.isLoading.value || prDetail.error.value)"
        class="fixed inset-0 z-40 flex justify-end bg-black/30" data-test="pr-detail-pending"
        @click.self="closeRequest"
      >
        <aside class="h-full w-full max-w-xl bg-surface border-l border-border p-6">
          <p v-if="prDetail.isLoading.value" class="text-sm text-text-muted">Chargement de la demande…</p>
          <p
            v-else data-test="pr-detail-error" role="alert"
            class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >{{ prDetail.error.value }}</p>
          <button
            type="button" data-test="pr-detail-pending-close"
            class="mt-6 rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated"
            @click="closeRequest"
          >Fermer</button>
        </aside>
      </div>
    </template>

    <template v-else>
      <AnnouncementsTable
        :announcements="anns" :loading="annLoading" :error="annError" :busy="annBusy"
        @remove="removeAnnouncement" @restore="restoreAnnouncement"
      />
      <div class="mt-4">
        <PaginationControls :page="annPage" :total-pages="annTotalPages" @change="goToAnnPage" />
      </div>
    </template>
  </div>
</template>
