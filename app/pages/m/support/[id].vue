<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useMobileSupportTicket } from '@/features/mobile/composables/useMobileSupportTicket'
import { shortName } from '@/features/mobile/lib/mobileSupport'
import { messageTime } from '@/features/support/lib/supportWorkbench'

definePageMeta({ layout: 'mobile', middleware: 'admin-only', permission: 'SUPPORT_TICKET_VIEW', pageTitle: 'Conversation' })

const route = useRoute()
const {
  ticket, messages, isLoading, error, notFound, draft, sending, sendError, isResolved, canReply, canSend, canAssign, heldByColleague, assigning, assignError, load, send, assign,
} = useMobileSupportTicket(computed(() => route.params?.id))

onMounted(load)
</script>

<template>
  <div>
    <NuxtLink to="/m/support" class="mb-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-primary">Support</NuxtLink>

    <p v-if="notFound" data-test="ticket-not-found" class="text-sm text-text-muted">Conversation introuvable.</p>
    <p v-else-if="error" data-test="ticket-error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <p v-else-if="isLoading && !ticket" class="text-sm text-text-muted">Chargement…</p>

    <article v-else-if="ticket" class="space-y-4">
      <header>
        <h2 data-test="support-subject" class="font-display text-lg font-bold text-text">{{ ticket.subject }}</h2>
        <p class="text-xs text-text-muted">{{ shortName(ticket.userDisplayName) }}</p>
      </header>

      <div class="flex flex-col gap-2" data-test="bubbles">
        <div
          v-for="m in messages" :key="m.id" data-test="bubble" :data-author="m.authorType"
          class="max-w-[85%] rounded-2xl px-3 py-2 text-sm"
          :class="m.authorType === 'ADMIN' ? 'self-end bg-primary text-white' : 'self-start border border-border bg-surface text-text'"
        >
          <p v-if="m.content" class="whitespace-pre-wrap break-words">{{ m.content }}</p>
          <p v-if="m.attachments?.length" class="text-xs italic opacity-80">Pièce jointe, à voir sur l’ordinateur</p>
          <p class="mt-1 text-[11px] opacity-70">{{ messageTime(m.createdAt) }}</p>
        </div>
        <p v-if="!messages.length" class="text-sm text-text-muted">Aucun message.</p>
      </div>

      <p v-if="isResolved" data-test="resolved-note" class="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-text-muted">
        Conversation résolue : plus de réponse possible.
      </p>

      <p v-if="heldByColleague" data-test="colleague-note" class="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-text-muted">Billet pris en charge par un collègue</p>
      <p v-if="assignError" data-test="assign-error" class="text-sm text-danger" role="alert">{{ assignError }}</p>
      <!-- Réponse refusée (billet changé de main) : le champ a disparu, le message reste lisible. -->
      <p v-if="sendError && !canReply" data-test="reply-error" class="text-sm text-danger" role="alert">{{ sendError }}</p>
      <div v-if="canAssign" class="sticky -mx-4 bottom-0 -mb-4 border-t border-border bg-surface px-4 py-3">
        <button
          type="button" data-test="assign-button" :disabled="assigning"
          class="min-h-[48px] w-full whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-60"
          @click="assign"
        >Prendre en charge</button>
      </div>

      <form
        v-if="canReply" data-test="reply-form"
        class="sticky -mx-4 bottom-0 -mb-4 space-y-2 border-t border-border bg-surface px-4 py-3"
        @submit.prevent="send"
      >
        <p v-if="sendError" data-test="reply-error" class="text-sm text-danger" role="alert">{{ sendError }}</p>
        <label for="mobile-reply" class="sr-only">Votre réponse</label>
        <textarea
          id="mobile-reply" v-model="draft" data-test="reply-input" rows="3" :readonly="sending" placeholder="Votre réponse…"
          class="w-full rounded-xl border border-border bg-bg p-2 text-base text-text"
        />
        <button
          type="submit" data-test="reply-send" :disabled="!canSend"
          class="min-h-[48px] w-full whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-60"
        >Envoyer</button>
      </form>
    </article>
  </div>
</template>
