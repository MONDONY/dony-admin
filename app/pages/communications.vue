<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BroadcastComposer from '@/features/broadcast/components/BroadcastComposer.vue'
import BroadcastHistoryTable from '@/features/broadcast/components/BroadcastHistoryTable.vue'
import BroadcastSegmentsPanel from '@/features/broadcast/components/BroadcastSegmentsPanel.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useBroadcast } from '@/features/broadcast/composables/useBroadcast'
import { useBroadcastSegments } from '@/features/broadcast/composables/useBroadcastSegments'
import type { BroadcastSegment, BroadcastTarget } from '@/features/broadcast/types/index'
import { useAuthStore } from '@/stores/auth'

definePageMeta({
  middleware: 'admin-only',
  permission: 'NOTIFICATION_SEND',
  pageTitle: 'Communications',
  pageSubtitle: 'Diffusion de notifications aux utilisateurs',
})

const {
  history, isLoading, busy, previewing, error, audience, fields, targetUserName, targetUserReachable, currentPage, totalPages,
  fetchHistory, fetchFields, goToPage, preview, send,
} = useBroadcast()
const segs = useBroadcastSegments()
const editSegment = ref<BroadcastSegment | null>(null)
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
async function onSend(title: string, body: string, target: BroadcastTarget, push: boolean) {
  await send(title, body, target, push)
}

async function onRename(segment: BroadcastSegment, name: string) {
  const message = await segs.rename(segment, name)
  if (message) segs.error.value = message
}
async function onRemove(id: string) {
  const message = await segs.remove(id)
  if (message) segs.error.value = message
  else if (editSegment.value?.id === id) editSegment.value = null
}
function onEditRule(segment: BroadcastSegment) {
  editSegment.value = segment
  // Le constructeur est en haut de page : on y ramène l'admin.
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  void fetchHistory()
  void fetchFields()
  void segs.fetchSegments()
})
</script>

<template>
  <div>
    <p
      v-if="error" data-test="broadcast-error"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ error }}</p>

    <BroadcastComposer
      class="mb-6"
      :audience="audience" :busy="busy" :previewing="previewing" :fields="fields"
      :segments="segs.segments.value" :edit-segment="editSegment"
      :save-segment-fn="segs.create" :update-segment-fn="segs.update"
      :initial-user-id="initialUserId" :target-user-name="targetUserName" :target-user-unreachable="targetUserReachable === false" :can-search-users="auth.can('USER_VIEW')"
      @preview="onPreview" @send="onSend" @edit-done="editSegment = null"
    />

    <BroadcastSegmentsPanel
      class="mb-6"
      :segments="segs.segments.value" :loading="segs.loading.value" :error="segs.error.value"
      @rename="onRename" @edit-rule="onEditRule" @remove="onRemove"
    />

    <BroadcastHistoryTable :broadcasts="history" :loading="isLoading" />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>
  </div>
</template>
