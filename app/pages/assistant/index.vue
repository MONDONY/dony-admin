<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import ProviderFormDialog from '@/features/assistant/components/ProviderFormDialog.vue'
import ProvidersTable from '@/features/assistant/components/ProvidersTable.vue'
import { useAssistantProviders } from '@/features/assistant/composables/useAssistantProviders'
import type { AdminProvider } from '@/features/assistant/types'

definePageMeta({
  middleware: 'admin-only',
  permission: 'ASSISTANT_MANAGE',
  pageTitle: 'Assistant IA',
  pageSubtitle: "Fournisseurs utilisés pour répondre aux questions dans l'app",
})

const s = useAssistantProviders()
const dialogOpen = ref(false)
const editing = ref<AdminProvider | null>(null)
const deleting = ref<AdminProvider | null>(null)
const isDeleting = ref(false)

onMounted(() => s.fetch())

function openAdd() { editing.value = null; dialogOpen.value = true }
function openEdit(p: AdminProvider) { editing.value = p; dialogOpen.value = true }
function onSaved(p: AdminProvider) { s.replace(p); dialogOpen.value = false }
async function confirmDelete() {
  // Le dialogue de confirmation reste affiché pendant la requête : un second clic ne doit pas la rejouer.
  if (!deleting.value || isDeleting.value) return
  isDeleting.value = true
  try {
    await s.remove(deleting.value.id)
  } finally {
    isDeleting.value = false
    deleting.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="s.unavailable.value" data-test="assistant-unavailable" class="rounded-card border border-border bg-surface p-4 text-sm text-text-muted">
      L'assistant n'est pas encore disponible sur ce serveur.
    </p>
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="max-w-2xl rounded-card bg-surface-elevated px-4 py-3 text-sm text-pretty">
          Les fournisseurs sont essayés dans l'ordre. Quand l'un atteint son quota, l'assistant passe au suivant.
          Glissez les lignes, ou utilisez les flèches, pour changer l'ordre.
        </p>
        <button type="button" data-test="assistant-add"
          class="inline-flex items-center gap-2 rounded-btn bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 active:scale-[0.96]"
          @click="openAdd"><Plus class="size-4" aria-hidden="true" />Ajouter un fournisseur</button>
      </div>
      <p v-if="!s.isLoading.value && !s.error.value && !s.hasActive.value" data-test="assistant-no-active" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
        Aucun fournisseur actif : l'assistant répond seulement avec les fiches d'aide.
      </p>
      <p v-if="s.error.value" data-test="assistant-error" class="text-sm text-danger">{{ s.error.value }}</p>
      <p v-if="s.actionError.value" data-test="assistant-action-error" role="alert" class="text-sm text-danger">{{ s.actionError.value }}</p>
      <p v-if="s.isLoading.value" class="text-sm text-text-muted">Chargement…</p>
      <ProvidersTable v-else :providers="s.providers.value" :test-results="s.testResults.value" :testing-id="s.testingId.value" :moving="s.isMoving.value"
        @move="s.move" @toggle="s.toggle" @test="s.runTest" @edit="openEdit" @delete="(p) => (deleting = p)" />
    </template>

    <ProviderFormDialog :open="dialogOpen" :provider="editing" @close="dialogOpen = false" @saved="onSaved" />
    <ConfirmActionDialog :open="deleting !== null" title="Supprimer le fournisseur"
      :message="`Supprimer ${deleting?.name ?? ''} ? L'assistant ne l'utilisera plus.`" confirm-label="Supprimer" confirm-tone="danger"
      @confirm="confirmDelete" @cancel="deleting = null" />
  </div>
</template>
