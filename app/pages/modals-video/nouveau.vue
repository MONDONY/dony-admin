<script setup lang="ts">
import { computed, ref } from 'vue'
import { Clapperboard, MessageSquareText } from 'lucide-vue-next'
import VideoModalForm from '@/features/video-modals/components/VideoModalForm.vue'
import { useVideoModals } from '@/features/video-modals/composables/useVideoModals'
import type { VideoModalInput, VideoModalType } from '@/features/video-modals/types/index'

definePageMeta({
  middleware: 'admin-only',
  permission: 'NOTIFICATION_SEND',
  pageTitle: 'Nouveau modal',
  pageSubtitle: 'Créé en version 1, pour ceux qui n’ont jamais répondu',
})

const { busy, error, createWithImage } = useVideoModals()

/** Le type se choisit d'abord et ne change plus après la création. */
const type = ref<VideoModalType | null>(null)
const choices = computed(() => [
  { type: 'VIDEO' as const, title: 'Vidéo', hint: 'Une vidéo YouTube avec ses points forts et deux boutons.', icon: Clapperboard },
  { type: 'INFO' as const, title: 'Information', hint: 'Un message court avec une icône et un ou deux boutons (écran de l’app, lien ou fermeture).', icon: MessageSquareText },
])

async function onSubmit(input: VideoModalInput, activate: boolean, imageFile: File | null) {
  const { modal, imageError } = await createWithImage(input, activate, imageFile)
  // Image refusée après la création : la fiche existe déjà, on y mène l'admin pour réessayer.
  if (modal) await navigateTo(imageError ? { path: `/modals-video/${modal.id}`, query: { image: 'echec' } } : `/modals-video/${modal.id}`)
}
</script>

<template>
  <div>
    <div v-if="!type" data-test="vm-type-picker">
      <p class="mb-3 text-sm font-semibold">Quel type de modal voulez-vous créer ?</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="c in choices" :key="c.type" type="button" :data-test="`vm-type-${c.type}`"
          class="flex items-start gap-3 rounded-card border border-border bg-surface p-5 text-left transition-colors hover:border-primary hover:bg-primary/5"
          @click="type = c.type"
        >
          <component :is="c.icon" class="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <b class="block text-base font-semibold">{{ c.title }}</b>
            <span class="text-sm text-text-muted text-pretty">{{ c.hint }}</span>
          </span>
        </button>
      </div>
      <NuxtLink to="/modals-video" class="mt-4 inline-block whitespace-nowrap rounded-btn border border-border px-4 py-2 text-sm hover:bg-surface-elevated">Annuler</NuxtLink>
    </div>

    <template v-else>
      <p
        v-if="error" data-test="vm-error"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ error }}</p>
      <VideoModalForm :key="type" :modal="null" :type="type" :busy="busy" @submit="onSubmit">
        <template #actions>
          <button
            type="button" data-test="vm-change-type"
            class="mr-auto whitespace-nowrap rounded-btn px-4 py-2 text-sm hover:bg-surface-elevated"
            @click="type = null"
          >Changer de type</button>
          <NuxtLink to="/modals-video" class="whitespace-nowrap rounded-btn border border-border px-4 py-2 text-sm hover:bg-surface-elevated">Annuler</NuxtLink>
        </template>
      </VideoModalForm>
    </template>
  </div>
</template>
