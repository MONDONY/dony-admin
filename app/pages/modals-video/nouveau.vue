<script setup lang="ts">
import VideoModalForm from '@/features/video-modals/components/VideoModalForm.vue'
import { useVideoModals } from '@/features/video-modals/composables/useVideoModals'
import type { VideoModalInput } from '@/features/video-modals/types/index'

definePageMeta({
  middleware: 'admin-only',
  permission: 'NOTIFICATION_SEND',
  pageTitle: 'Nouveau modal vidéo',
  pageSubtitle: 'Créé en version 1, pour ceux qui n’ont jamais répondu',
})

const { busy, error, save } = useVideoModals()

async function onSubmit(input: VideoModalInput, activate: boolean) {
  const created = await save(null, input, activate)
  if (created) await navigateTo(`/modals-video/${created.id}`)
}
</script>

<template>
  <div>
    <p
      v-if="error" data-test="vm-error"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ error }}</p>
    <VideoModalForm :modal="null" :busy="busy" @submit="onSubmit">
      <template #actions>
        <NuxtLink to="/modals-video" class="whitespace-nowrap rounded-btn border border-border px-4 py-2 text-sm hover:bg-surface-elevated">Annuler</NuxtLink>
      </template>
    </VideoModalForm>
  </div>
</template>
