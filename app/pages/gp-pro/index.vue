<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import GpProApplicationsTable from '@/features/gp-pro/components/GpProApplicationsTable.vue'
import GpProReviewTable from '@/features/gp-pro/components/GpProReviewTable.vue'
import GpProDetailPanel from '@/features/gp-pro/components/GpProDetailPanel.vue'
import { gpProService } from '@/features/gp-pro/services/gpProService'
import { useGpProList } from '@/features/gp-pro/composables/useGpProList'
import { useGpProApplication } from '@/features/gp-pro/composables/useGpProApplication'
import { useGpProAction } from '@/features/gp-pro/composables/useGpProAction'
import { GP_PRO_UNAVAILABLE } from '@/features/gp-pro/types/index'
import type { AdminGpProApplicationRow, AdminGpProReviewRow } from '@/features/gp-pro/types/index'
import { useAuthStore } from '@/stores/auth'

definePageMeta({
  middleware: 'admin-only', permission: 'GP_PRO_REVIEW',
  pageTitle: 'GP Pro', pageSubtitle: 'Demandes du badge et titulaires à revoir',
})

type Tab = 'demandes' | 'revue'
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const tab = ref<Tab>(route.query?.tab === 'revue' ? 'revue' : 'demandes')

const applications = useGpProList<AdminGpProApplicationRow>(
  (p, s) => gpProService.listApplications(p, s), 'Impossible de charger les demandes')
const review = useGpProList<AdminGpProReviewRow>(
  (p, s) => gpProService.listReview(p, s), 'Impossible de charger les titulaires à revoir')
const detail = useGpProApplication()
const dismissal = useGpProAction({ onStale: () => { void review.load() } })
const openId = ref<string | null>(null)

/** Onglet et demande ouverte vivent dans l'URL (?tab=revue&open=<id>) : liens profonds. */
function syncQuery() {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) {
    if (k !== 'tab' && k !== 'open' && typeof v === 'string') query[k] = v
  }
  if (tab.value === 'revue') query.tab = 'revue'
  if (openId.value) query.open = openId.value
  router.replace({ query })
}

async function setTab(next: Tab) {
  tab.value = next
  syncQuery()
  await (next === 'revue' ? review.load(0) : applications.load(0))
}
async function open(id: string) {
  openId.value = id
  syncQuery()
  await detail.load(id)
}
function close() {
  openId.value = null
  detail.clear()
  syncQuery()
}
async function onDecided() {
  // La demande quitte la file : la fiche se ferme, la file se relit.
  close()
  await applications.load()
}
async function onStale() {
  if (!openId.value) return
  await Promise.all([detail.refresh(openId.value), applications.load()])
}
async function dismiss(flagId: string) {
  if (await dismissal.run(() => gpProService.dismissFlag(flagId), 'L’alerte n’a pas pu être écartée')) {
    await review.load()
  }
}

watch(() => route.query?.open, (v) => {
  if (typeof v === 'string' && v && v !== openId.value) void open(v)
})

onMounted(async () => {
  const deepLink = route.query?.open
  await Promise.all([
    tab.value === 'revue' ? review.load(0) : applications.load(0),
    typeof deepLink === 'string' && deepLink ? open(deepLink) : Promise.resolve(),
  ])
})

const tabClass = (t: Tab) => tab.value === t ? 'border-b-2 border-primary text-text' : 'text-text-muted hover:text-text'
</script>

<template>
  <div>
    <div class="mb-4 flex gap-1 border-b border-border" role="tablist">
      <button
        type="button" data-test="gp-pro-tab-demandes" role="tab" :aria-selected="tab === 'demandes'"
        class="rounded-t-btn px-4 py-2 text-sm" :class="tabClass('demandes')" @click="setTab('demandes')"
      >Demandes</button>
      <button
        type="button" data-test="gp-pro-tab-revue" role="tab" :aria-selected="tab === 'revue'"
        class="rounded-t-btn px-4 py-2 text-sm" :class="tabClass('revue')" @click="setTab('revue')"
      >À revoir</button>
    </div>

    <template v-if="tab === 'demandes'">
      <p
        v-if="applications.unavailable.value" data-test="gp-pro-unavailable"
        class="rounded-card border border-border bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted"
      >{{ GP_PRO_UNAVAILABLE }}</p>
      <template v-else>
        <p
          v-if="applications.error.value" data-test="gp-pro-error" role="alert"
          class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >{{ applications.error.value }}</p>
        <p class="mb-2 text-xs text-text-muted tabular-nums">
          {{ applications.totalElements.value }} demande{{ applications.totalElements.value > 1 ? 's' : '' }} à examiner
        </p>
        <GpProApplicationsTable :items="applications.items.value" :loading="applications.isLoading.value" @select="open" />
        <div class="mt-4">
          <PaginationControls :page="applications.currentPage.value" :total-pages="applications.totalPages.value" @change="applications.goToPage" />
        </div>
      </template>
    </template>

    <template v-else>
      <p
        v-if="review.unavailable.value" data-test="gp-pro-review-unavailable"
        class="rounded-card border border-border bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted"
      >{{ GP_PRO_UNAVAILABLE }}</p>
      <template v-else>
        <p class="mb-3 text-sm text-text-muted text-pretty">
          Ces alertes ne retirent jamais le badge. Écartez une alerte qui ne justifie rien ; une nouvelle alerte ne revient que sur un nouveau motif. Le retrait se fait depuis la fiche utilisateur.
        </p>
        <p
          v-if="review.error.value || dismissal.error.value" data-test="gp-pro-review-error" role="alert"
          class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >{{ review.error.value ?? dismissal.error.value }}</p>
        <GpProReviewTable
          :items="review.items.value" :loading="review.isLoading.value" :busy="dismissal.busy.value"
          :can-dismiss="auth.can('GP_PRO_REVIEW') && !dismissal.unavailable.value"
          @dismiss="dismiss"
        />
        <div class="mt-4">
          <PaginationControls :page="review.currentPage.value" :total-pages="review.totalPages.value" @change="review.goToPage" />
        </div>
      </template>
    </template>

    <GpProDetailPanel
      v-if="openId"
      :application-id="openId" :detail="detail.detail.value" :loading="detail.isLoading.value" :error="detail.error.value"
      @close="close" @decided="onDecided" @stale="onStale" @refresh="() => openId && detail.refresh(openId)"
    />
  </div>
</template>
