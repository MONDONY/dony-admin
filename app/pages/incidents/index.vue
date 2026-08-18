<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DisputesTable from '@/features/incidents/components/DisputesTable.vue'
import DisputeDetailPanel from '@/features/incidents/components/DisputeDetailPanel.vue'
import NoShowsTable from '@/features/incidents/components/NoShowsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useDisputes } from '@/features/incidents/composables/useDisputes'
import { useDisputeDetail } from '@/features/incidents/composables/useDisputeDetail'
import { useNoShows } from '@/features/incidents/composables/useNoShows'

definePageMeta({ middleware: 'admin-only', permission: 'DISPUTE_VIEW', pageTitle: 'Incidents', pageSubtitle: 'Litiges & no-shows' })

const tab = ref<'disputes' | 'noshows'>('disputes')
const { disputes, isLoading, totalPages, currentPage, fetchDisputes, goToPage } = useDisputes()
const detail = useDisputeDetail()
const noshows = useNoShows()

async function afterAction() { await fetchDisputes() }
async function switchTab(t: 'disputes' | 'noshows') {
  tab.value = t
  if (t === 'noshows' && noshows.cancellations.value.length === 0) await noshows.fetchCancellations()
}

onMounted(fetchDisputes)
</script>

<template>
  <div>
    <div class="flex gap-1 mb-4">
      <button type="button" data-test="tab-disputes" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'disputes' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('disputes')">Litiges</button>
      <button type="button" data-test="tab-noshows" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'noshows' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('noshows')">No-shows</button>
    </div>

    <template v-if="tab === 'disputes'">
      <DisputesTable :disputes="disputes" :loading="isLoading" @select="detail.open" />
      <div class="mt-4"><PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" /></div>
      <DisputeDetailPanel
        v-if="detail.dispute.value"
        :dispute="detail.dispute.value" :open="detail.dispute.value !== null"
        @close="detail.close"
        @resolve="async (r, n) => { await detail.resolve(r, n); await afterAction() }"
        @guarantee="async (c, r) => { await detail.payGuarantee(c, '', r); await afterAction() }"
      />
    </template>

    <NoShowsTable v-else :cancellations="noshows.cancellations.value" :loading="noshows.isLoading.value"
      @confirm="async (bidId) => { await noshows.confirm(bidId) }" />
  </div>
</template>
