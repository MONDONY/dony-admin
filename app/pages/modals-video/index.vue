<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import NewVersionDialog from '@/features/video-modals/components/NewVersionDialog.vue'
import VideoModalTable from '@/features/video-modals/components/VideoModalTable.vue'
import { useVideoModals } from '@/features/video-modals/composables/useVideoModals'
import type { AdminVideoModal, NewVersionInput } from '@/features/video-modals/types/index'

definePageMeta({
  middleware: 'admin-only',
  permission: 'NOTIFICATION_SEND',
  pageTitle: 'Modals',
  pageSubtitle: 'Vidéos et messages présentés dans l’app, avec leur moment, leur ciblage et leurs versions',
})

const { items, loading, busy, pendingActive, error, fetchAll, publishVersion, setActive, remove } = useVideoModals()

/** Faux tant que la première liste n'est pas arrivée : jamais de « Aucun modal » avant ou pendant le chargement. */
const loaded = ref(false)
const versionTarget = ref<AdminVideoModal | null>(null)
const removeTarget = ref<AdminVideoModal | null>(null)

async function onToggle(m: AdminVideoModal, active: boolean) {
  await setActive(m.id, active)
}
async function onPublish(input: NewVersionInput) {
  if (!versionTarget.value) return
  if (await publishVersion(versionTarget.value.id, input)) versionTarget.value = null
}
async function onRemove() {
  if (!removeTarget.value) return
  const id = removeTarget.value.id
  removeTarget.value = null
  await remove(id)
}

onMounted(async () => {
  await fetchAll()
  loaded.value = true
})
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-2xl text-sm text-text-muted text-pretty">
        Une campagne = un modal (vidéo ou information), avec son moment, son ciblage, sa fréquence et ses versions. Plusieurs peuvent être actives ;
        l’app n’en ouvre qu’un par ouverture, la priorité la plus haute d’abord, puis la version publiée le plus récemment.
      </p>
      <NuxtLink
        to="/modals-video/nouveau" data-test="vm-new"
        class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-btn bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
      ><Plus class="h-4 w-4" aria-hidden="true" />Nouveau modal</NuxtLink>
    </div>

    <p
      v-if="error && items.length" data-test="vm-error"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ error }}</p>

    <VideoModalTable
      v-if="items.length" :items="items" :busy="busy" :pending-ids="pendingActive"
      @toggle-active="onToggle" @new-version="(m) => versionTarget = m" @remove="(m) => removeTarget = m"
    />
    <StateBlock
      v-else :loading="loading || !loaded" :error="error" :empty="loaded && !loading && !error"
      empty-label="Aucun modal pour le moment." hint="Tant qu’aucune campagne n’est active, l’app n’affiche rien."
      empty-test="vm-empty" @retry="fetchAll"
    />

    <NewVersionDialog
      :open="versionTarget !== null" :modal="versionTarget" :busy="busy"
      @confirm="onPublish" @cancel="versionTarget = null"
    />
    <ConfirmActionDialog
      :open="removeTarget !== null"
      title="Supprimer le modal"
      :message="`« ${removeTarget?.name ?? ''} » ne sera plus affiché dans l’app. Ses résultats restent dans l’historique.`"
      confirm-label="Supprimer"
      @confirm="onRemove" @cancel="removeTarget = null"
    />
  </div>
</template>
