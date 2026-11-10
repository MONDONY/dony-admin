<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import NewVersionDialog from '@/features/video-modals/components/NewVersionDialog.vue'
import VideoModalForm from '@/features/video-modals/components/VideoModalForm.vue'
import { useVideoModals } from '@/features/video-modals/composables/useVideoModals'
import type { NewVersionInput, VideoModalInput } from '@/features/video-modals/types/index'
import { useBreadcrumbLabel } from '@/composables/useBreadcrumbLabel'
import { uuidParam } from '@/lib/safeInput'

definePageMeta({
  middleware: 'admin-only',
  permission: 'NOTIFICATION_SEND',
  pageTitle: 'Modal vidéo',
  pageSubtitle: 'Contenus, déclencheurs et versions',
})

const route = useRoute()
const crumb = useBreadcrumbLabel()
const { current, loading, busy, error, fetchOne, save, publishVersion, setActive, remove } = useVideoModals()

const id = computed(() => uuidParam(route.params?.id))
const saved = ref(false)
const versionOpen = ref(false)
const removeOpen = ref(false)
// Une nouvelle version peut changer la vidéo : le formulaire repart de la campagne publiée.
const formKey = computed(() => (current.value ? `${current.value.id}-${current.value.version}` : 'none'))

watch(id, (v) => { if (v) void fetchOne(v) }, { immediate: true })
watch(() => current.value?.name, n => crumb.set(n))
onBeforeUnmount(() => crumb.clear())

async function onSubmit(input: VideoModalInput) {
  if (!id.value) return
  saved.value = false
  saved.value = (await save(id.value, input)) !== null
}
async function onToggle(active: boolean) {
  if (id.value) await setActive(id.value, active)
}
async function onPublish(input: NewVersionInput) {
  if (id.value && await publishVersion(id.value, input)) versionOpen.value = false
}
async function onRemove() {
  removeOpen.value = false
  if (id.value && await remove(id.value)) await navigateTo('/modals-video')
}
</script>

<template>
  <div>
    <p
      v-if="error && current" data-test="vm-error"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ error }}</p>
    <p
      v-else-if="saved" data-test="vm-saved" role="status"
      class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
    >Modifications enregistrées, sans nouvelle version.</p>

    <VideoModalForm
      v-if="current" :key="formKey" :modal="current" :busy="busy"
      @submit="onSubmit" @toggle-active="onToggle" @new-version="versionOpen = true"
    >
      <template #actions>
        <button
          type="button" data-test="vm-delete" :disabled="busy"
          class="mr-auto whitespace-nowrap rounded-btn px-4 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-40"
          @click="removeOpen = true"
        >Supprimer</button>
        <NuxtLink to="/modals-video" class="whitespace-nowrap rounded-btn border border-border px-4 py-2 text-sm hover:bg-surface-elevated">Retour</NuxtLink>
      </template>
    </VideoModalForm>
    <StateBlock
      v-else :loading="loading" :error="error ?? (id ? null : 'Identifiant de modal invalide.')"
      :empty="!loading && !error && !!id" empty-label="Modal vidéo introuvable." @retry="id && fetchOne(id)"
    />

    <NewVersionDialog :open="versionOpen" :modal="current" :busy="busy" @confirm="onPublish" @cancel="versionOpen = false" />
    <ConfirmActionDialog
      :open="removeOpen"
      title="Supprimer le modal vidéo"
      :message="`« ${current?.name ?? ''} » ne sera plus affiché dans l’app. Ses résultats restent dans l’historique.`"
      confirm-label="Supprimer"
      @confirm="onRemove" @cancel="removeOpen = false"
    />
  </div>
</template>
