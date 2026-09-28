<script setup lang="ts">
import { computed, onMounted } from 'vue'
import BroadcastComposer from '@/features/broadcast/components/BroadcastComposer.vue'
import BroadcastHistoryTable from '@/features/broadcast/components/BroadcastHistoryTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useBroadcast } from '@/features/broadcast/composables/useBroadcast'
import type { BroadcastTarget } from '@/features/broadcast/types/index'
import { useAuthStore } from '@/stores/auth'

definePageMeta({
  middleware: 'admin-only',
  permission: 'NOTIFICATION_SEND',
  pageTitle: 'Communications',
  pageSubtitle: 'Diffusion de notifications aux utilisateurs',
})

const {
  history, isLoading, busy, previewing, error, recipientCount, targetUserName, targetUserReachable, currentPage, totalPages,
  fetchHistory, goToPage, preview, send,
} = useBroadcast()
const auth = useAuthStore()
const route = useRoute()
// « Envoyer une notification » depuis la fiche utilisateur : /communications?target=USER&userId=<id>.
const initialUserId = computed(() => {
  const q = route.query ?? {}
  return q.target === 'USER' && typeof q.userId === 'string' && q.userId.trim() ? q.userId.trim() : null
})

async function onPreview(target: BroadcastTarget) {
  await preview(target)
}
async function onSend(title: string, body: string, target: BroadcastTarget) {
  await send(title, body, target)
}

onMounted(fetchHistory)
</script>

<template>
  <div>
    <p
      v-if="error" data-test="broadcast-error"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ error }}</p>

    <BroadcastComposer
      class="mb-6"
      :recipient-count="recipientCount" :busy="busy" :previewing="previewing"
      :initial-user-id="initialUserId" :target-user-name="targetUserName" :target-user-unreachable="targetUserReachable === false" :can-search-users="auth.can('USER_VIEW')"
      @preview="onPreview" @send="onSend"
    />

    <BroadcastHistoryTable :broadcasts="history" :loading="isLoading" />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>
  </div>
</template>
