<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BidsTable from '@/features/bids/components/BidsTable.vue'
import BidDetailPanel from '@/features/bids/components/BidDetailPanel.vue'
import AnnouncementsTable from '@/features/bids/components/AnnouncementsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useAdminBids } from '@/features/bids/composables/useAdminBids'
import { useBidTimeline } from '@/features/bids/composables/useBidTimeline'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminAnnouncementListItem } from '@/features/bids/types/index'

definePageMeta({ middleware: 'admin-only', pageTitle: 'Colis', pageSubtitle: 'Bids & annonces' })

const tab = ref<'bids' | 'announcements'>('bids')
const { bids, isLoading, totalPages, currentPage, fetchBids, goToPage } = useAdminBids()
const detail = useBidTimeline()
const anns = ref<AdminAnnouncementListItem[]>([])
const annLoading = ref(false)

async function loadAnns() {
  annLoading.value = true
  try {
    anns.value = (await bidsAdminService.listAnnouncements(0, 20)).content
  } finally {
    annLoading.value = false
  }
}

async function switchTab(t: 'bids' | 'announcements') {
  tab.value = t
  if (t === 'announcements' && anns.value.length === 0) {
    await loadAnns()
  }
}

onMounted(fetchBids)
</script>

<template>
  <div>
    <div class="flex gap-1 mb-4">
      <button
        type="button"
        data-test="tab-bids"
        :class="[
          'rounded-full px-3 py-1.5 text-sm',
          tab === 'bids' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted',
        ]"
        @click="switchTab('bids')"
      >
        Bids
      </button>
      <button
        type="button"
        data-test="tab-announcements"
        :class="[
          'rounded-full px-3 py-1.5 text-sm',
          tab === 'announcements' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted',
        ]"
        @click="switchTab('announcements')"
      >
        Annonces
      </button>
    </div>

    <template v-if="tab === 'bids'">
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

    <AnnouncementsTable v-else :announcements="anns" :loading="annLoading" />
  </div>
</template>
