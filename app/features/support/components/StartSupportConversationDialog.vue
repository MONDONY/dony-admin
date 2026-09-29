<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import BroadcastUserPicker from '@/features/broadcast/components/BroadcastUserPicker.vue'
import SupportAttachmentUploader from '@/features/support/components/SupportAttachmentUploader.vue'
import { useStartSupportConversation } from '@/features/support/composables/useStartSupportConversation'
import type { AdminSupportTicket, SupportCategory } from '@/features/support/types/index'
import { CATEGORY_LABELS, SUPPORT_MESSAGE_MAX, SUPPORT_SUBJECT_MAX } from '@/features/support/utils/format'
import { useAuthStore } from '@/stores/auth'

/**
 * « Écrire à cet utilisateur » : l'admin ouvre lui-même une conversation support. Depuis la
 * fiche utilisateur le destinataire est imposé (`recipient`) ; depuis la page Support, on le
 * cherche. En cas de succès le fil s'ouvre (l'admin en est déjà l'assigné).
 */
const props = defineProps<{
  open: boolean
  recipient?: { id: string; name: string } | null
}>()
const emit = defineEmits<{ close: []; sent: [ticket: AdminSupportTicket] }>()

const auth = useAuthStore()
const baseId = useId()
const CATEGORIES = Object.entries(CATEGORY_LABELS) as [SupportCategory, string][]

const pickedUserId = ref('')
const category = ref<SupportCategory>('OTHER')
const subject = ref('')
const message = ref('')
const attachmentKeys = ref<string[]>([])
const uploading = ref(false)
const subjectRef = ref<HTMLInputElement | null>(null)
const { sending, error, fieldErrors, unavailable, submit, reset } = useStartSupportConversation()

watch(() => props.open, async (open) => {
  if (!open) return
  pickedUserId.value = ''
  category.value = 'OTHER'
  subject.value = ''
  message.value = ''
  attachmentKeys.value = []
  uploading.value = false
  reset()
  await nextTick()
  if (props.recipient) subjectRef.value?.focus()
}, { immediate: true })

const targetUserId = computed(() => props.recipient?.id ?? pickedUserId.value)
const subjectLength = computed(() => subject.value.trim().length)
const messageLength = computed(() => message.value.trim().length)
const subjectTooLong = computed(() => subjectLength.value > SUPPORT_SUBJECT_MAX)
const messageTooLong = computed(() => messageLength.value > SUPPORT_MESSAGE_MAX)

// Texte OU au moins une image : un message seul est facultatif dès qu'une image est prête.
const hasContent = computed(() => messageLength.value > 0 || attachmentKeys.value.length > 0)
const canSend = computed(() =>
  !sending.value && !uploading.value && !unavailable.value
  && targetUserId.value.length > 0
  && subjectLength.value > 0 && !subjectTooLong.value
  && hasContent.value && !messageTooLong.value)

async function send() {
  if (!canSend.value) return
  const ticket = await submit({
    userId: targetUserId.value,
    category: category.value,
    subject: subject.value.trim(),
    message: message.value.trim() || null,
    attachmentKeys: attachmentKeys.value,
  })
  if (!ticket) return
  emit('sent', ticket)
  await navigateTo(`/support?ticket=${encodeURIComponent(ticket.id)}`)
}

function close() {
  if (!sending.value) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="close">
    <div
      data-test="start-dialog" role="dialog" aria-modal="true" :aria-labelledby="`${baseId}-title`"
      class="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
      @keydown="onKeydown"
    >
      <h2 :id="`${baseId}-title`" class="mb-4 font-display text-lg font-semibold text-balance">
        Écrire à cet utilisateur
      </h2>

      <div class="space-y-4">
        <div
          v-if="recipient" data-test="start-recipient"
          class="rounded-btn border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
        >
          <span class="block text-xs text-text-muted">Destinataire</span>
          <span class="block truncate font-medium text-text">{{ recipient.name }}</span>
        </div>
        <BroadcastUserPicker
          v-else v-model="pickedUserId" :can-search="auth.can('USER_VIEW')" :disabled="sending"
        />
        <p v-if="fieldErrors.userId" data-test="start-field-error-userId" class="-mt-3 text-xs text-danger">
          {{ fieldErrors.userId }}
        </p>

        <div>
          <label :for="`${baseId}-category`" class="block text-xs text-text-muted">Catégorie</label>
          <select
            :id="`${baseId}-category`" v-model="category" data-test="start-category" :disabled="sending"
            class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-60"
          >
            <option v-for="[code, label] in CATEGORIES" :key="code" :value="code">{{ label }}</option>
          </select>
          <p v-if="fieldErrors.category" data-test="start-field-error-category" class="mt-1 text-xs text-danger">
            {{ fieldErrors.category }}
          </p>
        </div>

        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label :for="`${baseId}-subject`" class="block text-xs text-text-muted">Sujet (obligatoire)</label>
            <span
              data-test="start-subject-count" class="shrink-0 text-xs tabular-nums"
              :class="subjectTooLong ? 'text-danger' : 'text-text-muted'"
            >{{ subjectLength }} / {{ SUPPORT_SUBJECT_MAX }}</span>
          </div>
          <input
            :id="`${baseId}-subject`" ref="subjectRef" v-model="subject" data-test="start-subject" type="text"
            :disabled="sending" autocomplete="off"
            class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-60"
          >
          <p v-if="fieldErrors.subject" data-test="start-field-error-subject" class="mt-1 text-xs text-danger">
            {{ fieldErrors.subject }}
          </p>
        </div>

        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label :for="`${baseId}-message`" class="block text-xs text-text-muted">Message</label>
            <span
              data-test="start-message-count" class="shrink-0 text-xs tabular-nums"
              :class="messageTooLong ? 'text-danger' : 'text-text-muted'"
            >{{ messageLength }} / {{ SUPPORT_MESSAGE_MAX }}</span>
          </div>
          <textarea
            :id="`${baseId}-message`" v-model="message" data-test="start-message" rows="5" :disabled="sending"
            class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-60"
          />
          <p v-if="fieldErrors.message" data-test="start-field-error-message" class="mt-1 text-xs text-danger">
            {{ fieldErrors.message }}
          </p>
          <p v-else data-test="start-message-hint" class="mt-1 text-xs text-text-muted text-pretty">
            Écrivez un message ou joignez au moins une image.
          </p>
        </div>

        <div>
          <span class="mb-1 block text-xs text-text-muted">Images (facultatif)</span>
          <SupportAttachmentUploader
            @change="(keys: string[]) => (attachmentKeys = keys)"
            @busy="(v: boolean) => (uploading = v)"
          />
          <p v-if="fieldErrors.attachmentKeys" data-test="start-field-error-attachmentKeys" class="mt-1 text-xs text-danger">
            {{ fieldErrors.attachmentKeys }}
          </p>
        </div>

        <p
          data-test="start-notice"
          class="rounded-btn border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-text text-pretty"
        >
          L’utilisateur recevra une notification et verra ce message dans Yadony Support, onglet Messages.
          Il pourra vous répondre.
        </p>

        <p
          v-if="error" data-test="start-error" role="alert"
          class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
        >{{ error }}</p>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button" data-test="start-cancel" :disabled="sending"
          class="rounded-btn border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-elevated disabled:opacity-40"
          @click="close"
        >Annuler</button>
        <button
          type="button" data-test="start-submit" :disabled="!canSend"
          class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="send"
        >{{ sending ? 'Envoi…' : 'Envoyer' }}</button>
      </div>
    </div>
  </div>
</template>
