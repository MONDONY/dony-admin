<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import SupportAttachmentUploader from '@/features/support/components/SupportAttachmentUploader.vue'
import { useReportReply } from '@/features/signalements/composables/useReportReply'
import { REPORT_REPLY_MAX, hasSupportConversation, supportConversationLink } from '@/features/signalements/reportReply'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import type { AdminReport, ReportReplyResponse } from '@/features/signalements/types/index'

/**
 * « Répondre » au signalant d'un rapport de bug : rappel du signalement en lecture seule,
 * réponse et images. Le back ouvre (ou réutilise) la conversation support ; le signalement
 * garde son statut. Les erreurs restent dans la fenêtre.
 */
const props = defineProps<{
  /** Signalement auquel répondre ; null = fenêtre fermée. */
  report: AdminReport | null
}>()
const emit = defineEmits<{ close: []; sent: [response: ReportReplyResponse] }>()

const baseId = useId()
const message = ref('')
const attachmentKeys = ref<string[]>([])
const uploading = ref(false)
const messageRef = ref<HTMLTextAreaElement | null>(null)
const { sending, error, fieldErrors, unavailable, submit, reset } = useReportReply()

// Un autre signalement repart de zéro (brouillon, images, erreurs).
watch(() => props.report?.id, async (id) => {
  message.value = ''
  attachmentKeys.value = []
  uploading.value = false
  reset()
  if (!id) return
  await nextTick()
  messageRef.value?.focus()
}, { immediate: true })

const existing = computed(() => (props.report && hasSupportConversation(props.report) ? props.report.supportTicketId! : null))
const title = computed(() => (existing.value ? 'Répondre à nouveau' : 'Répondre au signalant'))
const messageLength = computed(() => message.value.trim().length)
const tooLong = computed(() => messageLength.value > REPORT_REPLY_MAX)
const canSend = computed(() =>
  !sending.value && !uploading.value && !unavailable.value && messageLength.value > 0 && !tooLong.value)

function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }

async function send() {
  if (!canSend.value || !props.report) return
  const response = await submit(props.report.id, {
    message: message.value.trim(),
    attachmentKeys: attachmentKeys.value,
  })
  if (response) emit('sent', response)
}

function close() {
  if (!sending.value) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
</script>

<template>
  <div
    v-if="report" data-test="reply-overlay"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="close"
  >
    <div
      data-test="reply-dialog" role="dialog" aria-modal="true" :aria-labelledby="`${baseId}-title`"
      class="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
      @keydown="onKeydown"
    >
      <h2 :id="`${baseId}-title`" data-test="reply-title" class="mb-4 font-display text-lg font-semibold text-balance">{{ title }}</h2>

      <div class="space-y-4">
        <!-- Rappel du signalement, en lecture seule -->
        <section
          data-test="reply-recap" aria-label="Signalement"
          class="rounded-btn bg-surface-elevated px-3 py-2.5 text-sm shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-text-muted">
            <span>{{ reportReasonLabel(report.reason) }} · {{ report.reporterName ?? 'Inconnu' }}</span>
            <span class="tabular-nums">{{ fmt(report.createdAt) }}</span>
          </div>
          <p
            v-if="report.description" data-test="reply-recap-message"
            class="mt-1.5 whitespace-pre-wrap text-text text-pretty"
          >{{ report.description }}</p>
          <p v-else class="mt-1.5 text-text-muted italic">Aucun message</p>
          <div
            v-if="report.screenRoute" data-test="reply-recap-screen"
            class="mt-2 inline-block rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-text-muted"
          >Écran {{ report.screenRoute }}</div>
          <div v-if="report.photoUrls?.length" class="mt-2 flex flex-wrap gap-1.5">
            <a
              v-for="(url, i) in report.photoUrls" :key="i" :href="url" target="_blank" rel="noopener"
              :data-test="`reply-recap-photo-${i}`"
              class="block h-12 w-12 overflow-hidden rounded outline outline-1 -outline-offset-1 outline-black/10 transition-[box-shadow] hover:ring-2 hover:ring-primary"
            >
              <img :src="url" alt="Capture jointe" class="h-full w-full object-cover">
            </a>
          </div>
        </section>

        <p
          v-if="existing" data-test="reply-existing"
          class="rounded-btn border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-text text-pretty"
        >
          Votre réponse s’ajoutera à la conversation déjà ouverte avec le signalant.
          <NuxtLink :to="supportConversationLink(existing)" class="text-primary underline-offset-2 hover:underline">Ouvrir la conversation</NuxtLink>
        </p>

        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label :for="`${baseId}-message`" class="block text-xs text-text-muted">Votre réponse</label>
            <span
              data-test="reply-count" class="shrink-0 text-xs tabular-nums"
              :class="tooLong ? 'text-danger' : 'text-text-muted'"
            >{{ messageLength }} / {{ REPORT_REPLY_MAX }}</span>
          </div>
          <textarea
            :id="`${baseId}-message`" ref="messageRef" v-model="message" data-test="reply-message" rows="5"
            :disabled="sending"
            class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text disabled:opacity-60"
          />
          <p v-if="fieldErrors.message" data-test="reply-field-error-message" class="mt-1 text-xs text-danger">
            {{ fieldErrors.message }}
          </p>
        </div>

        <div>
          <span class="mb-1 block text-xs text-text-muted">Images (facultatif)</span>
          <SupportAttachmentUploader
            @change="(keys: string[]) => (attachmentKeys = keys)"
            @busy="(v: boolean) => (uploading = v)"
          />
          <p v-if="fieldErrors.attachmentKeys" data-test="reply-field-error-attachmentKeys" class="mt-1 text-xs text-danger">
            {{ fieldErrors.attachmentKeys }}
          </p>
        </div>

        <p data-test="reply-notice" class="text-xs text-text-muted text-pretty">Le signalant recevra une notification. Le signalement reste ouvert : marquez-le traité quand le bug est corrigé.</p>

        <p
          v-if="error" data-test="reply-error" role="alert"
          class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
        >{{ error }}</p>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button" data-test="reply-cancel" :disabled="sending"
          class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="close"
        >Annuler</button>
        <button
          type="button" data-test="reply-submit" :disabled="!canSend" :aria-busy="sending ? 'true' : 'false'"
          class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="send"
        >{{ sending ? 'Envoi…' : 'Envoyer' }}</button>
      </div>
    </div>
  </div>
</template>
