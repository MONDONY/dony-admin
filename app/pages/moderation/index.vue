<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ConversationsTable from '@/features/moderation/components/ConversationsTable.vue'
import MessageThread from '@/features/moderation/components/MessageThread.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useConversations } from '@/features/moderation/composables/useConversations'
import { useConversationThread } from '@/features/moderation/composables/useConversationThread'

definePageMeta({ middleware: 'admin-only', permission: 'MODERATION_VIEW', pageTitle: 'Modération', pageSubtitle: 'Conversations et messages' })

const { conversations, isLoading, totalPages, currentPage, filters, fetchConversations, goToPage, setFlaggedOnly } = useConversations()
const thread = useConversationThread()
const pendingDeleteId = ref<string | null>(null)

async function confirmDelete() {
  if (pendingDeleteId.value) await thread.deleteMessage(pendingDeleteId.value)
  pendingDeleteId.value = null
}

onMounted(fetchConversations)
</script>

<template>
  <div>
    <label class="flex items-center gap-2 mb-4 text-sm text-text-muted cursor-pointer">
      <input
        type="checkbox" data-test="flagged-only"
        :checked="filters.flaggedOnly"
        @change="setFlaggedOnly(($event.target as HTMLInputElement).checked)"
      >
      Signalées uniquement
    </label>

    <ConversationsTable :conversations="conversations" :loading="isLoading" @open="thread.open" />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>

    <!-- Panneau de conversation -->
    <div
      v-if="thread.activeId.value !== null"
      class="fixed inset-0 z-50 flex justify-end bg-black/40" data-test="thread-overlay"
      @click.self="thread.close"
    >
      <div class="h-full w-full max-w-lg bg-bg border-l border-border flex flex-col">
        <div class="flex items-center justify-between border-b border-border p-4">
          <h2 class="font-display text-lg font-semibold">Conversation</h2>
          <button
            type="button" data-test="thread-close"
            class="rounded-btn px-3 py-1.5 text-sm border border-border hover:bg-surface-elevated"
            @click="thread.close"
          >Fermer</button>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <MessageThread
            :messages="thread.messages.value" :loading="thread.isLoading.value"
            @delete="(id) => pendingDeleteId = id"
          />
        </div>
      </div>
    </div>

    <ConfirmActionDialog
      :open="pendingDeleteId !== null"
      title="Supprimer le message"
      message="Le message sera masqué des deux participants (soft delete)."
      confirm-label="Supprimer"
      :require-reason="true"
      @confirm="confirmDelete"
      @cancel="pendingDeleteId = null"
    />
  </div>
</template>
