<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useMobileMessageThread } from '@/features/mobile/composables/useMobileMessageThread'
import { messageTime } from '@/features/support/lib/supportWorkbench'

definePageMeta({ layout: 'mobile', middleware: 'admin-only', permission: 'MODERATION_VIEW', pageTitle: 'Conversation' })

const route = useRoute()
const { bubbles, participants, isLoading, error, invalid, openImage, load, showImage, closeImage } = useMobileMessageThread(computed(() => route.params?.id))

onMounted(load)
</script>

<template>
  <div>
    <NuxtLink to="/m/messages" class="mb-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-primary">‹ Messages</NuxtLink>

    <p v-if="invalid" data-test="thread-invalid" class="text-sm text-text-muted">Conversation introuvable.</p>
    <div v-else-if="error" class="space-y-2">
      <p data-test="thread-error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <button type="button" data-test="thread-retry" class="min-h-[44px] whitespace-nowrap rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text" @click="load">Réessayer</button>
    </div>
    <p v-else-if="isLoading && !bubbles.length" class="text-sm text-text-muted">Chargement…</p>

    <article v-else class="space-y-4">
      <header v-if="participants.length">
        <h2 data-test="thread-participants" class="font-display text-lg font-bold text-text">{{ participants.join(' et ') }}</h2>
      </header>

      <div class="flex flex-col gap-2" data-test="bubbles">
        <div
          v-for="b in bubbles" :key="b.id" data-test="bubble" :data-flagged="b.flagged ? 'true' : undefined" :data-deleted="b.deleted ? 'true' : undefined"
          class="max-w-[85%] self-start rounded-2xl border px-3 py-2 text-sm"
          :class="b.flagged ? 'border-danger bg-danger/10 text-danger' : 'border-border bg-surface text-text'"
        >
          <p data-test="bubble-sender" class="text-xs font-semibold opacity-80">{{ b.sender }}</p>
          <p v-if="b.deleted" data-test="bubble-deleted" class="italic text-text-muted">Message supprimé</p>
          <template v-else>
            <button
              v-if="b.image" type="button" data-test="bubble-image" class="my-1 block min-h-[44px] overflow-hidden rounded-xl" aria-label="Voir la photo en grand"
              @click="showImage(b.image.full)"
            >
              <img :src="b.image.thumb" alt="Photo envoyée" loading="lazy" referrerpolicy="no-referrer" class="max-h-48 w-auto max-w-full">
            </button>
            <p v-if="b.content" class="whitespace-pre-wrap break-words">{{ b.content }}</p>
            <p v-if="b.flagged" data-test="bubble-reason" class="mt-1 text-xs font-semibold">Signalé{{ b.reason ? ` : ${b.reason}` : '' }}</p>
          </template>
          <p class="mt-1 text-[11px] opacity-70">{{ messageTime(b.createdAt) }}</p>
        </div>
        <p v-if="!bubbles.length" class="text-sm text-text-muted">Aucun message.</p>
      </div>

      <p data-test="desktop-note" class="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-text-muted">
        Pour supprimer un message ou sanctionner, passez sur l’ordinateur.
      </p>
    </article>

    <div
      v-if="openImage" data-test="image-overlay" role="dialog" aria-modal="true" aria-label="Photo en grand"
      class="fixed inset-0 z-50 flex flex-col bg-black/90"
    >
      <button type="button" data-test="image-close" class="min-h-[44px] self-end px-4 text-sm font-semibold text-white" @click="closeImage">Fermer</button>
      <div class="flex min-h-0 flex-1 items-center justify-center p-4">
        <img :src="openImage" alt="Photo envoyée" referrerpolicy="no-referrer" class="max-h-full max-w-full object-contain">
      </div>
    </div>
  </div>
</template>
