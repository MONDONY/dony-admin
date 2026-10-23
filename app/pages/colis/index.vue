<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import BidsTable from '@/features/bids/components/BidsTable.vue'
import BidFilters from '@/features/bids/components/BidFilters.vue'
import BidSearchBox from '@/features/bids/components/BidSearchBox.vue'
import BidViewTabs from '@/features/bids/components/BidViewTabs.vue'
import BidAlertPills from '@/features/bids/components/BidAlertPills.vue'
import BidActiveFilters from '@/features/bids/components/BidActiveFilters.vue'
import BidDetailPanel from '@/features/bids/components/BidDetailPanel.vue'
import AnnouncementsTable from '@/features/bids/components/AnnouncementsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useAdminBids } from '@/features/bids/composables/useAdminBids'
import { useBidCounts } from '@/features/bids/composables/useBidCounts'
import { useBidSuggestions } from '@/features/bids/composables/useBidSuggestions'
import { BID_VIEWS } from '@/features/bids/lib/bidViews'
import { BID_URL_FILTERS, bidActiveChips, bidEmptyState, bidInitialView, searchFromSuggestion } from '@/features/bids/lib/bidPageFilters'
import { useBidTimeline } from '@/features/bids/composables/useBidTimeline'
import { useAdminAnnouncements } from '@/features/bids/composables/useAdminAnnouncements'
import PackageRequestFilters from '@/features/package-requests/components/PackageRequestFilters.vue'
import PackageRequestsTable from '@/features/package-requests/components/PackageRequestsTable.vue'
import PackageRequestDetailPanel from '@/features/package-requests/components/PackageRequestDetailPanel.vue'
import { usePackageRequests } from '@/features/package-requests/composables/usePackageRequests'
import { usePackageRequestDetail, PACKAGE_REQUESTS_UNAVAILABLE } from '@/features/package-requests/composables/usePackageRequestDetail'
import TabBar, { type TabItem } from '@/components/ui/TabBar.vue'
import { useUrlFilters } from '@/composables/useUrlFilters'
import { useAuthStore } from '@/stores/auth'
import { uuidParam } from '@/lib/safeInput'

definePageMeta({ middleware: 'admin-only', permission: 'BID_VIEW', pageTitle: 'Colis', pageSubtitle: 'Colis, annonces & demandes d’envoi' })

type Tab = 'bids' | 'announcements' | 'demandes'
const TABS: readonly Tab[] = ['bids', 'announcements', 'demandes']

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const tab = ref<Tab>('bids')
// Évalué au montage : la session n'existe pas au rendu serveur, un `v-if` direct sur
// `auth.can()` ferait diverger l'hydratation.
const canSeeRequests = ref(false)
const tabItems = computed<TabItem<Tab>[]>(() => [
  { id: 'bids', label: 'Colis' },
  { id: 'announcements', label: 'Annonces' },
  ...(canSeeRequests.value ? [{ id: 'demandes' as const, label: 'Demandes' }] : []),
])
const {
  bids, isLoading, error: bidsError, totalPages, currentPage, filters, fetchBids, goToPage,
  setStatusFilter, search, setDateRange, setAnnouncementFilter, setView, setScope, setPaymentMethod, setContent, setAlert, resetFilters,
} = useAdminBids()
// Nombres par vue et suggestions : endpoints neufs, absents d'un ancien back (repli sans vues ni suggestions).
const countsApi = useBidCounts(filters)
const suggestApi = useBidSuggestions()
// Onglets de vue : seulement une fois les nombres répondus, et jamais face à un ancien back.
const viewsReady = computed(() => countsApi.settled.value && !countsApi.unavailable.value)
const viewsAvailable = computed(() => !countsApi.unavailable.value)
/** Change à chaque choix de suggestion ou fiche ouverte depuis la recherche : le champ reprend la requête appliquée. */
const searchResetKey = ref(0)

// Avant le premier rendu (et avant que l'URL ne soit suivie) : vue par défaut selon les paramètres
// valides reçus (un lien ?status= ou ?announcementId= montre « Tous », pas un « À traiter » vide).
filters.view = bidInitialView(route.query ?? {})
// Filtres de l'onglet Colis dans l'URL (?view=ACTIVE&status=IN_TRANSIT&query=…), à côté de tab/open/announcementId.
// La vue par défaut dépend des autres paramètres : elle n'est écrite que si elle en diffère, et un
// « Tous » choisi depuis « À traiter » reste donc dans l'URL.
const urlFilters = useUrlFilters(filters, {
  view: {
    default: 'ALL',
    allowed: BID_VIEWS.map(v => v.id),
    defaultFrom: q => (countsApi.unavailable.value ? 'ALL' : bidInitialView(q)),
  },
  ...BID_URL_FILTERS,
})
urlFilters.restore()
const activeChips = computed(() => bidActiveChips(filters))
const emptyState = computed(() => bidEmptyState(filters))
const detail = useBidTimeline()
const {
  announcements: anns, isLoading: annLoading, error: annError, busy: annBusy,
  currentPage: annPage, totalPages: annTotalPages,
  focusId: annFocusId,
  load: loadAnns, goToPage: goToAnnPage, focus: focusAnnouncement, remove: removeAnnouncement, restore: restoreAnnouncement,
} = useAdminAnnouncements()

// ---- Demandes d'envoi ----
const pr = usePackageRequests()
const prDetail = usePackageRequestDetail()
let prLoaded = false
let bidsLoaded = false
async function loadBidsOnce() {
  if (bidsLoaded) return
  bidsLoaded = true
  await Promise.all([fetchBids(), countsApi.sync()])
}

/**
 * L'onglet, la fiche ouverte et les filtres « trajet » vivent dans l'URL : liens profonds
 * (?tab=demandes&open=<id>, ?open=<colisId>, ?announcementId=<annonce> pour les colis d'un
 * trajet, ?tab=announcements&announcement=<annonce> pour l'annonce d'un colis).
 */
const OWN_KEYS = ['tab', 'open', 'announcementId', 'announcement', 'section']
function syncQuery(next: { tab: Tab; open?: string | null }) {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) {
    if (!OWN_KEYS.includes(k) && typeof v === 'string') query[k] = v
  }
  if (next.tab !== 'bids') query.tab = next.tab
  if (next.open) query.open = next.open
  if (next.tab === 'bids' && filters.announcementId) query.announcementId = filters.announcementId
  if (next.tab === 'announcements' && annFocusId.value) query.announcement = annFocusId.value
  // Filtres réécrits sur cette query-là : la vue est écrite ou non selon le trajet qu'elle porte.
  router.replace({ query: urlFilters.apply(query) as Record<string, string> })
}

// ---- Fiche colis ----
async function openBid(id: string) {
  syncQuery({ tab: 'bids', open: id })
  await detail.open(id)
}
function closeBid() {
  detail.close()
  syncQuery({ tab: 'bids' })
}
/** « Voir l'annonce » : onglet Annonces réduit à l'annonce du colis. */
async function showAnnouncement(id: string) {
  detail.close()
  tab.value = 'announcements'
  await focusAnnouncement(id)
  syncQuery({ tab: 'announcements' })
}
async function clearAnnouncementFocus() {
  await focusAnnouncement(null)
  syncQuery({ tab: 'announcements' })
}
/** « Autres colis sur ce trajet » : liste des colis filtrée sur l'annonce. */
async function showTripBids(id: string) {
  detail.close()
  bidsLoaded = true
  // Comme le lien ?announcementId= : tous les colis du trajet, pas seulement ceux « À traiter ».
  filters.view = 'ALL'
  await setAnnouncementFilter(id)
  syncQuery({ tab: 'bids' })
}
async function clearTripFilter() {
  await setAnnouncementFilter(null)
  syncQuery({ tab: 'bids' })
}

async function switchTab(t: Tab) {
  tab.value = t
  if (t !== 'demandes') prDetail.close()
  if (t !== 'bids') detail.close()
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
/** Colis annulé ou litige ouvert depuis la fiche : fiche, chronologie, liste et nombres relus. */
async function onBidChanged() {
  await Promise.all([detail.reload(), fetchBids(), countsApi.unavailable.value ? null : countsApi.reload()])
}

// ---- Vues, recherche et filtres de l'onglet Colis ----
// Les nombres suivent la recherche et les filtres communs, pas la vue, le statut ni l'alerte.
watch(
  () => [filters.query, filters.scope, filters.paymentMethod, filters.content, filters.dateFrom, filters.dateTo, filters.announcementId],
  () => { if (bidsLoaded && !countsApi.unavailable.value) void countsApi.sync() },
)
// Ancien back : pas de vues ni de filtres neufs. La liste déjà reçue les ignorait, rien à recharger.
watch(countsApi.unavailable, (missing) => {
  if (!missing) return
  Object.assign(filters, { view: 'ALL', alert: null, paymentMethod: null, content: '' })
})

function onType(text: string) {
  if (!suggestApi.unavailable.value) suggestApi.query(text)
}
/** Recherche validée (Entrée ou « Chercher ») ; un n° exact affiché arrive en `pick` de colis. */
async function onSearch(text: string) {
  suggestApi.clear()
  await search(text)
}
/**
 * Suggestion choisie : une personne ou un trajet devient une recherche à portée (puce retirable),
 * un colis ouvre sa fiche. Dans les deux cas le champ reprend la requête appliquée.
 */
async function onPick(...[kind, payload]: Parameters<typeof searchFromSuggestion>) {
  suggestApi.clear()
  searchResetKey.value++
  const picked = searchFromSuggestion(kind, payload)
  if (!picked) {
    await openBid((payload as { bidId: string }).bidId)
    return
  }
  await search(picked.query, picked.scope)
}
async function removeChip(key: string) {
  if (key === 'search') await search('', 'ALL')
  else if (key === 'status') await setStatusFilter('TOUS')
  else if (key === 'period') await setDateRange(null, null)
  else if (key === 'payment') await setPaymentMethod(null)
  else if (key === 'content') await setContent('')
  else if (key === 'alert') await setAlert(null)
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
    const openId = uuidParam(route.query?.open)
    await Promise.all([
      pr.load(),
      openId ? prDetail.open(openId) : Promise.resolve(),
    ])
    return
  }
  if (initial === 'announcements') {
    tab.value = 'announcements'
    const focused = uuidParam(route.query?.announcement)
    if (focused) await focusAnnouncement(focused)
    else await loadAnns()
    return
  }
  // ?announcementId=<annonce> : colis d'un même trajet.
  // Identifiants de l'URL validés (UUID) avant tout appel : `?open=../../x` est ignoré.
  const tripId = uuidParam(route.query?.announcementId)
  if (tripId) filters.announcementId = tripId
  // ?open=<colisId> sur l'onglet Colis (lien « Ouvrir le colis » d'un no-show, d'un paiement) : ouvre la fiche.
  const openParam = uuidParam(route.query?.open)
  await Promise.all([
    loadBidsOnce(),
    openParam ? detail.open(openParam) : Promise.resolve(),
  ])
})

// Page déjà ouverte : la recherche globale (barre du haut) ne change que la query. On n'agit
// que si la cible diffère de ce qui est affiché : syncQuery réécrit la même query sans boucler.
watch(() => [route.query?.tab, route.query?.open, route.query?.announcement] as const, async ([t, o, a]) => {
  const wanted: Tab = typeof t === 'string' && (TABS as readonly string[]).includes(t) ? t as Tab : 'bids'
  const openId = uuidParam(o)
  if (wanted === 'announcements') {
    const focused = uuidParam(a)
    if (focused && focused !== annFocusId.value) await showAnnouncement(focused)
    return
  }
  if (wanted === 'demandes') {
    if (!canSeeRequests.value || !openId || openId === prDetail.openId.value) return
    if (tab.value !== 'demandes') await switchTab('demandes')
    await openRequest(openId)
    return
  }
  if (!openId || openId === detail.openId.value) return
  if (tab.value !== 'bids') await switchTab('bids')
  await openBid(openId)
})
</script>

<template>
  <div>
    <TabBar class="mb-4" :tabs="tabItems" :model-value="tab" aria-label="Sections des colis" @update:model-value="switchTab" />

    <template v-if="tab === 'bids'">
      <div class="mb-4 space-y-3">
        <div v-if="viewsReady">
          <BidViewTabs :model-value="filters.view" :counts="countsApi.counts.value" @update:model-value="setView" />
          <p v-if="countsApi.error.value" data-test="bid-counts-error" role="status" class="mt-1 flex items-center gap-2 text-xs text-text-muted">
            Nombres indisponibles
            <button
              type="button" data-test="bid-counts-retry"
              class="inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              @click="countsApi.reload()"
            >Réessayer</button>
          </p>
        </div>
        <BidSearchBox
          :model-query="filters.query" :model-scope="filters.scope" :reset-key="searchResetKey"
          :suggestions="suggestApi.suggestions.value" :suggestions-disabled="suggestApi.unavailable.value"
          @type="onType" @update:query="onSearch" @update:scope="setScope" @pick="onPick"
        />
        <BidAlertPills
          v-if="viewsReady && (filters.view === 'TODO' || filters.view === 'ALL')"
          :model-value="filters.alert" :alerts="countsApi.counts.value?.alerts ?? null" @update:model-value="setAlert"
        />
        <BidFilters
          :filters="filters" :views-available="viewsAvailable"
          @update:status="setStatusFilter"
          @update:date-range="(from, to) => setDateRange(from, to)"
          @update:payment-method="setPaymentMethod"
          @update:content="setContent"
          @reset="resetFilters"
        />
        <BidActiveFilters :chips="activeChips" @remove="removeChip" @clear="resetFilters" />
      </div>
      <div
        v-if="filters.announcementId" data-test="trip-filter" role="status"
        class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-card border border-primary/30 bg-primary/5 px-4 py-2 text-sm"
      >
        <span>Colis d’un même trajet (annonce <span class="font-mono text-xs">{{ filters.announcementId.slice(0, 8) }}</span>)</span>
        <button
          type="button" data-test="trip-filter-clear"
          class="inline-flex min-h-10 items-center rounded-btn px-3 text-sm text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96]"
          @click="clearTripFilter"
        >Voir tous les colis</button>
      </div>
      <!-- « À traiter » vide : rien à dire avant la réponse des nombres (un ancien back bascule sur « Tous »). -->
      <BidsTable
        :bids="bids" :loading="isLoading || (filters.view === 'TODO' && bids.length === 0 && !countsApi.settled.value)" :error="bidsError"
        :empty-label="emptyState.label" :empty-hint="emptyState.hint"
        @select="openBid" @retry="fetchBids"
      />
      <div v-if="emptyState.action && !isLoading && !bidsError && bids.length === 0 && countsApi.settled.value" class="mt-3 flex justify-center">
        <button
          type="button" data-test="todo-show-all"
          class="inline-flex min-h-10 items-center rounded-btn px-3 text-sm text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          @click="setView('ALL')"
        >{{ emptyState.action }}</button>
      </div>
      <div class="mt-4">
        <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
      </div>
      <BidDetailPanel
        v-if="detail.bid.value"
        :bid="detail.bid.value"
        :timeline="detail.timeline.value"
        :timeline-loading="detail.timelineLoading.value"
        :timeline-error="detail.timelineError.value"
        :open="detail.bid.value !== null"
        @close="closeBid"
        @show-announcement="showAnnouncement"
        @show-trip-bids="showTripBids"
        @resynced="detail.reload"
        @changed="onBidChanged"
      />
      <div
        v-else-if="detail.openId.value && (detail.isLoading.value || detail.error.value)"
        class="fixed inset-0 z-40 flex justify-end bg-black/30" data-test="bid-detail-pending"
        @click.self="closeBid"
      >
        <aside class="h-full w-full max-w-2xl bg-surface border-l border-border p-6">
          <p v-if="detail.isLoading.value" class="text-sm text-text-muted">Chargement du colis…</p>
          <p
            v-else data-test="bid-detail-error" role="alert"
            class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >{{ detail.error.value }}</p>
          <button
            type="button" data-test="bid-detail-pending-close"
            class="mt-6 inline-flex min-h-10 items-center rounded-btn px-4 text-sm border border-border hover:bg-surface-elevated"
            @click="closeBid"
          >Fermer</button>
        </aside>
      </div>
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
      <div
        v-if="annFocusId" data-test="announcement-focus" role="status"
        class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-card border border-primary/30 bg-primary/5 px-4 py-2 text-sm"
      >
        <span>Annonce du colis (<span class="font-mono text-xs">{{ annFocusId.slice(0, 8) }}</span>)</span>
        <button
          type="button" data-test="announcement-focus-clear"
          class="inline-flex min-h-10 items-center rounded-btn px-3 text-sm text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96]"
          @click="clearAnnouncementFocus"
        >Voir toutes les annonces</button>
      </div>
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
