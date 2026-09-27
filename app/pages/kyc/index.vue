<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import KycQueueFilters from '@/features/kyc/components/KycQueueFilters.vue'
import KycQueueTable from '@/features/kyc/components/KycQueueTable.vue'
import KycDetailPanel from '@/features/kyc/components/KycDetailPanel.vue'
import { useKycQueue } from '@/features/kyc/composables/useKycQueue'
import { useUserKyc } from '@/features/users/composables/useUserKyc'
import { KYC_QUEUE_UNAVAILABLE, isKycQueueStatus } from '@/features/kyc/types/index'
import type { AdminKycQueueItem, KycQueueStatus } from '@/features/kyc/types/index'
import type { AdminKycDetail } from '@/features/users/types/index'

definePageMeta({
  middleware: 'admin-only', permission: 'USER_KYC',
  pageTitle: 'Vérifications d’identité', pageSubtitle: 'File KYC et décisions manuelles',
})

const route = useRoute()
const router = useRouter()
const wanted = route.query?.status
const queue = useKycQueue(isKycQueueStatus(wanted) ? wanted : 'IN_REVIEW')
const detail = useUserKyc()
const openId = ref<string | null>(null)
// Instantané pris à l'ouverture : après une décision, la ligne peut quitter la file filtrée,
// mais la fiche doit garder le nom (en-tête et ressaisie avant révocation).
const openedRow = ref<AdminKycQueueItem | null>(null)
const openRow = computed(() => queue.items.value.find((r) => r.userId === openId.value) ?? openedRow.value)

/** Le statut filtré et la fiche ouverte vivent dans l'URL (?status=REJECTED&open=<id>) : liens profonds. */
function syncQuery() {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) {
    if (k !== 'status' && k !== 'open' && typeof v === 'string') query[k] = v
  }
  if (queue.filters.status !== 'IN_REVIEW') query.status = queue.filters.status
  if (openId.value) query.open = openId.value
  router.replace({ query })
}

async function open(userId: string) {
  openId.value = userId
  openedRow.value = queue.items.value.find((r) => r.userId === userId) ?? null
  syncQuery()
  await detail.load(userId)
}
function close() {
  openId.value = null
  openedRow.value = null
  syncQuery()
}
async function setStatus(s: KycQueueStatus) {
  await queue.setStatus(s)
  syncQuery()
}

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

onMounted(async () => {
  const deepLink = route.query?.open
  await Promise.all([
    queue.load(0),
    typeof deepLink === 'string' && deepLink ? open(deepLink) : Promise.resolve(),
  ])
})
</script>

<template>
  <div>
    <p
      v-if="queue.unavailable.value" data-test="kyc-unavailable"
      class="rounded-card border border-border bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted"
    >{{ KYC_QUEUE_UNAVAILABLE }}</p>
    <template v-else>
      <KycQueueFilters
        :filters="queue.filters"
        @update:status="setStatus"
        @update:provider="queue.setProvider"
        @update:query="queue.setQuery"
        @update:date-range="(from, to) => queue.setDateRange(from, to)"
      />
      <p
        v-if="queue.error.value" data-test="kyc-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ queue.error.value }}</p>
      <p data-test="kyc-total" class="mb-2 text-xs text-text-muted tabular-nums">
        {{ queue.totalElements.value }} vérification{{ queue.totalElements.value > 1 ? 's' : '' }}
      </p>
      <KycQueueTable :items="queue.items.value" :loading="queue.isLoading.value" @select="open" />
      <div class="mt-4">
        <PaginationControls :page="queue.currentPage.value" :total-pages="queue.totalPages.value" @change="queue.goToPage" />
      </div>
    </template>

    <KycDetailPanel
      v-if="openId"
      :row="openRow" :user-id="openId"
      :kyc="detail.kyc.value" :loading="detail.isLoading.value" :error="detail.error.value" :reset-busy="detail.busy.value"
      @close="close" @decided="onDecided" @stale="onStale" @reset="onReset"
    />
  </div>
</template>
