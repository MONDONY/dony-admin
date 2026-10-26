<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import SupportAttachmentGrid from '@/features/support/components/SupportAttachmentGrid.vue'
import SupportAttachmentUploader from '@/features/support/components/SupportAttachmentUploader.vue'
import { reportLink } from '@/features/signalements/reportReply'
import { useAuthStore } from '@/stores/auth'
import type { AdminSupportTicket } from '@/features/support/types/index'
import { STATUS_LABELS, categoryLabel, formatDate, statusTone } from '@/features/support/utils/format'
import {
  groupMessagesByDay, insertQuickReply, messageTime, priorityMeta, QUICK_REPLIES, REPLY_MAX, silenceNote,
} from '@/features/support/lib/supportWorkbench'

/**
 * Conversation du ticket, au centre du poste : le fil par jour, puis la zone de réponse (réponses
 * types, pièces jointes), l'invitation à s'assigner, ou le constat que le ticket est résolu.
 */
const props = withDefaults(defineProps<{
  ticket: AdminSupportTicket | null
  /** Le fil est en cours de lecture. */
  loading?: boolean
  acting?: boolean
  /** Brouillon de ce ticket : conservé par la page quand on change de ticket. */
  draft?: string
  now?: number
}>(), { loading: false, acting: false, draft: '', now: undefined })
const emit = defineEmits<{
  'update:draft': [text: string]
  assign: [id: string]
  reply: [id: string, content: string, attachmentKeys: string[]]
}>()

const auth = useAuthStore()
const attachmentKeys = ref<string[]>([])
const uploading = ref(false)
/** Change après un envoi : l'envoi de pièces jointes repart d'une zone vide. */
const uploaderKey = ref(0)

const isResolved = computed(() => props.ticket?.status === 'RESOLVED')
const isMine = computed(() => !!props.ticket && props.ticket.assignedAdminId === auth.user?.id)
const isUnassigned = computed(() => props.ticket?.assignedAdminId === null)
const canManage = computed(() => auth.can('SUPPORT_TICKET_MANAGE'))
const days = computed(() => groupMessagesByDay(props.ticket?.messages ?? [], props.now))
const silence = computed(() => (props.ticket ? silenceNote(props.ticket, props.now) : null))
const priority = computed(() => (props.ticket ? priorityMeta(props.ticket.priority) : null))
const tooLong = computed(() => props.draft.length > REPLY_MAX)
const canSubmit = computed(() => !props.acting && !uploading.value && !tooLong.value
  && (props.draft.trim().length > 0 || attachmentKeys.value.length > 0))
const showComposer = computed(() => canManage.value && isMine.value && !isResolved.value)

function sendReply() {
  const t = props.ticket
  if (!t || !canSubmit.value || !showComposer.value) return
  emit('reply', t.id, props.draft.trim(), attachmentKeys.value)
  attachmentKeys.value = []
  uploaderKey.value += 1
}
/** Raccourci 1 à 9 : ajoute la réponse type n au brouillon. */
function quick(n: number) {
  const reply = QUICK_REPLIES[n - 1]
  if (reply && showComposer.value) emit('update:draft', insertQuickReply(props.draft, reply.text))
}
function openViewer(url: string) {
  window.open(url, '_blank', 'noopener')
}
defineExpose({ quick, submit: sendReply, canSubmit })
</script>

<template>
  <section aria-label="Conversation" data-test="support-conversation" class="flex min-h-[24rem] flex-col overflow-hidden rounded-card border border-border bg-surface">
    <p
      v-if="!ticket" data-test="support-conversation-empty"
      class="px-4 py-6 text-sm text-text-muted text-pretty"
    >Sélectionne un ticket dans la file pour lire la conversation.</p>

    <template v-else>
      <div class="border-b border-border p-5">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge :label="STATUS_LABELS[ticket.status]" :tone="statusTone(ticket.status)" />
          <StatusBadge :label="categoryLabel(ticket.category)" tone="neutral" />
          <StatusBadge v-if="priority" v-bind="priority" />
          <StatusBadge v-if="isMine" label="Assigné à moi" tone="info" />
          <StatusBadge v-else-if="ticket.assignedAdminEmail" :label="`Assigné : ${ticket.assignedAdminEmail}`" tone="neutral" />
          <StatusBadge v-else label="Non assigné" tone="warning" />
          <span class="ml-auto text-xs text-text-muted tabular-nums">Ouvert le {{ formatDate(ticket.createdAt) }}</span>
        </div>
        <h2 class="mt-3 font-display text-xl font-bold text-balance" data-test="support-subject">{{ ticket.subject }}</h2>
        <p v-if="ticket.sourceReportId" data-test="ticket-source-report" class="mt-1 text-xs text-text-muted">
          Issu du signalement
          <NuxtLink
            v-if="auth.can('REPORT_VIEW')" :to="reportLink(ticket.sourceReportId)"
            class="text-primary underline-offset-2 hover:underline"
          >Voir le signalement</NuxtLink>
          <span v-else>d’un rapport de bug</span>
        </p>
      </div>

      <div class="flex flex-1 flex-col gap-3 overflow-y-auto bg-bg/40 p-5" data-test="support-messages">
        <p v-if="loading && !ticket.messages" data-test="support-loading" class="text-center text-sm text-text-muted">Chargement de la conversation…</p>
        <template v-for="d in days" :key="d.key">
          <span class="self-center rounded-full bg-surface-elevated px-2.5 py-0.5 text-[11px] font-bold text-text-muted" :data-test="`support-day-${d.key}`">{{ d.label }}</span>
          <div
            v-for="m in d.messages" :key="m.id" :data-test="`support-message-${m.id}`"
            :class="['max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm',
              m.authorType === 'ADMIN' ? 'self-end bg-primary/10 text-text' : 'self-start border border-border bg-surface']"
          >
            <p class="mb-1 text-xs font-semibold text-text-muted">
              {{ m.authorType === 'ADMIN' ? 'Support' : ticket.userDisplayName }} · {{ messageTime(m.createdAt) }}
            </p>
            <p v-if="m.content" class="whitespace-pre-wrap">{{ m.content }}</p>
            <SupportAttachmentGrid v-if="m.attachments?.length" :attachments="m.attachments" class="mt-2" @open="openViewer" />
          </div>
        </template>
        <p v-if="ticket.messages && ticket.messages.length === 0" class="text-center text-sm text-text-muted">Aucun message</p>
        <span
          v-if="silence" data-test="support-silence"
          class="self-center rounded-full bg-danger/10 px-2.5 py-0.5 text-[11px] font-bold text-danger"
        >{{ silence }}</span>
      </div>

      <div v-if="isResolved" data-test="support-resolved" class="border-t border-border p-4 text-center text-sm text-text-muted">
        Ticket résolu le {{ formatDate(ticket.resolvedAt) }} : plus de réponse possible.
      </div>
      <div v-else-if="showComposer" class="border-t border-border p-4" data-test="support-composer">
        <div class="mb-2 flex flex-wrap items-center gap-1.5" data-test="support-quick-replies">
          <span class="mr-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Réponses types</span>
          <button
            v-for="(q, n) in QUICK_REPLIES" :key="q.label" type="button" :data-test="`support-quick-${n + 1}`" :title="q.text"
            class="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-[background-color,scale] hover:bg-surface-elevated hover:text-text active:scale-[0.96]"
            @click="quick(n + 1)"
          ><KeyHint>{{ n + 1 }}</KeyHint>{{ q.label }}</button>
        </div>
        <SupportAttachmentUploader :key="`${ticket.id}-${uploaderKey}`" class="mb-2" @change="attachmentKeys = $event" @busy="uploading = $event" />
        <label for="support-reply" class="sr-only">Votre réponse</label>
        <textarea
          id="support-reply" :value="draft" data-test="support-reply" rows="4" :disabled="acting"
          placeholder="Votre réponse…" :aria-invalid="tooLong ? 'true' : 'false'"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
          @input="emit('update:draft', ($event.target as HTMLTextAreaElement).value)"
        />
        <p v-if="tooLong" data-test="support-reply-problem" class="mt-1 text-xs text-warning">Réponse trop longue ({{ REPLY_MAX }} caractères au plus).</p>
        <div class="mt-2 flex items-center justify-between gap-3">
          <span class="text-xs text-text-muted">{{ draft.trim() ? 'Brouillon conservé' : 'Joindre une image · ⌘⏎ pour envoyer' }}</span>
          <button
            type="button" data-test="support-send" :disabled="!canSubmit" :aria-busy="acting ? 'true' : 'false'"
            class="rounded-btn bg-primary px-5 py-2 text-sm font-medium text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
            @click="sendReply"
          >{{ acting ? 'Envoi…' : 'Répondre' }}</button>
        </div>
      </div>
      <div v-else-if="canManage" data-test="support-assign-cta" class="border-t border-border p-5 text-center">
        <p class="text-sm text-text-muted">{{ isUnassigned ? 'Assignez-vous ce ticket pour répondre ou le résoudre.' : 'Ce ticket est assigné à un collègue : reprenez-le pour répondre.' }}</p>
        <button
          v-if="isUnassigned" type="button" data-test="support-assign" :disabled="acting"
          class="mt-3 rounded-btn bg-primary px-6 py-2.5 text-sm font-medium text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40"
          @click="emit('assign', ticket.id)"
        >M’assigner ce ticket</button>
      </div>
    </template>
  </section>
</template>
