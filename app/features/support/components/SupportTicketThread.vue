<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SupportAttachmentGrid from '@/features/support/components/SupportAttachmentGrid.vue'
import SupportAttachmentUploader from '@/features/support/components/SupportAttachmentUploader.vue'
import { useAuthStore } from '@/stores/auth'
import type { AdminSupportTicket } from '@/features/support/types/index'
import { STATUS_LABELS, formatDate, statusTone } from '@/features/support/utils/format'

const props = defineProps<{
  ticket: AdminSupportTicket
  acting: boolean
  actionError: string | null
}>()
const emit = defineEmits<{
  close: []
  assign: [id: string]
  reassign: [id: string, adminId: string]
  reply: [id: string, content: string, attachmentKeys: string[]]
  resolve: [id: string]
}>()

const auth = useAuthStore()
const draft = ref('')
const attachmentKeys = ref<string[]>([])
const uploading = ref(false)

function openViewer(url: string) {
  window.open(url, '_blank', 'noopener')
}

const isResolved = computed(() => props.ticket.status === 'RESOLVED')
const isMine = computed(() => props.ticket.assignedAdminId === auth.user?.id)
const isUnassigned = computed(() => props.ticket.assignedAdminId === null)
const canManage = computed(() => auth.can('SUPPORT_TICKET_MANAGE'))

const canSubmit = computed(() =>
  !props.acting && !uploading.value &&
  (draft.value.trim().length > 0 || attachmentKeys.value.length > 0))

function sendReply() {
  if (!canSubmit.value) return
  const content = draft.value.trim()
  emit('reply', props.ticket.id, content, attachmentKeys.value)
  draft.value = ''
  attachmentKeys.value = []
}

function onUploaderChange(keys: string[]) {
  attachmentKeys.value = keys
}

function onUploaderBusy(value: boolean) {
  uploading.value = value
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-b border-border p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">{{ ticket.subject }}</h2>
          <p class="mt-1 text-sm text-text-muted">
            {{ ticket.userDisplayName }} · {{ ticket.category }} ·
            ouvert le {{ formatDate(ticket.createdAt) }}
          </p>
        </div>
        <button
          type="button"
          class="text-sm text-text-muted hover:text-text"
          aria-label="Fermer le détail"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge :label="STATUS_LABELS[ticket.status]" :tone="statusTone(ticket.status)" />
        <StatusBadge
          v-if="ticket.assignedAdminEmail"
          :label="`Assigné : ${ticket.assignedAdminEmail}`"
          tone="neutral"
        />
        <StatusBadge v-else label="Non assigné" tone="warning" />
      </div>
      <div v-if="canManage && !isResolved" class="mt-3 flex flex-wrap gap-2">
        <button
          v-if="isUnassigned"
          type="button"
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          :disabled="acting"
          @click="emit('assign', ticket.id)"
        >
          M'assigner ce ticket
        </button>
        <button
          v-else-if="!isMine"
          type="button"
          class="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          :disabled="acting"
          @click="auth.user && emit('reassign', ticket.id, auth.user.id)"
        >
          Reprendre ce ticket
        </button>
        <button
          v-if="isMine"
          type="button"
          class="rounded-md border border-success px-3 py-1.5 text-sm font-medium text-success disabled:opacity-50"
          :disabled="acting"
          @click="emit('resolve', ticket.id)"
        >
          Marquer résolu
        </button>
      </div>
      <p v-if="actionError" class="mt-2 text-sm text-danger">{{ actionError }}</p>
    </div>

    <div class="flex-1 space-y-3 overflow-y-auto p-4">
      <div
        v-for="m in ticket.messages ?? []"
        :key="m.id"
        :class="[
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          m.authorType === 'ADMIN'
            ? 'ml-auto bg-primary/10 text-text'
            : 'mr-auto border border-border bg-surface-elevated',
        ]"
      >
        <p class="mb-1 text-xs font-semibold text-text-muted">
          {{ m.authorType === 'ADMIN' ? 'Support' : ticket.userDisplayName }}
          · {{ formatDate(m.createdAt) }}
        </p>
        <p v-if="m.content" class="whitespace-pre-wrap">{{ m.content }}</p>
        <SupportAttachmentGrid
          v-if="m.attachments?.length"
          :attachments="m.attachments"
          class="mt-2"
          @open="openViewer"
        />
      </div>
      <p
        v-if="(ticket.messages ?? []).length === 0"
        class="text-center text-sm text-text-muted"
      >
        Aucun message
      </p>
    </div>

    <div v-if="isResolved" class="border-t border-border p-4 text-center text-sm text-text-muted">
      Ticket résolu le {{ formatDate(ticket.resolvedAt) }} — plus aucune action possible.
    </div>
    <div v-else-if="canManage && isMine" class="border-t border-border p-4">
      <SupportAttachmentUploader
        class="mb-2"
        @change="onUploaderChange"
        @busy="onUploaderBusy"
      />
      <textarea
        v-model="draft"
        rows="3"
        placeholder="Votre réponse…"
        class="w-full rounded-md border border-border bg-surface p-2 text-sm"
        :disabled="acting"
      />
      <div class="mt-2 flex justify-end">
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          :disabled="!canSubmit"
          @click="sendReply"
        >
          {{ acting ? 'Envoi…' : 'Répondre' }}
        </button>
      </div>
    </div>
    <div v-else-if="canManage" class="border-t border-border p-4 text-center text-sm text-text-muted">
      Assignez-vous ce ticket pour répondre ou le résoudre.
    </div>
  </div>
</template>
