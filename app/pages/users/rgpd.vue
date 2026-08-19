<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import GdprRequestsTable from '@/features/users/components/GdprRequestsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useGdprRequests } from '@/features/users/composables/useGdprRequests'
import { gdprConfirmationPhrase } from '@/features/users/gdprTarget'
import type { AdminGdprRequest } from '@/features/users/types/index'

definePageMeta({
  middleware: 'admin-only',
  permission: 'USER_GDPR_DELETE',
  pageTitle: 'Demandes RGPD',
  pageSubtitle: 'File des suppressions de compte',
})

const { requests, isLoading, error, busy, currentPage, totalPages, fetchRequests, goToPage, execute }
  = useGdprRequests()

// Geste irréversible : double confirmation par saisie du nom exact de l'utilisateur,
// en plus du motif obligatoire.
const pending = ref<AdminGdprRequest | null>(null)
// La phrase ne doit jamais être vide : ConfirmActionDialog désactive purement et simplement
// la double confirmation sur une chaîne vide. Voir gdprConfirmationPhrase.
const pendingName = computed(() =>
  pending.value ? gdprConfirmationPhrase(pending.value) : '',
)

async function confirmExecute(reason: string) {
  const target = pending.value
  pending.value = null
  if (target) await execute(target.id, reason)
}

onMounted(fetchRequests)
</script>

<template>
  <div>
    <p
      v-if="error" data-test="gdpr-error"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ error }}</p>

    <GdprRequestsTable :requests="requests" :loading="isLoading || busy" @execute="(r) => pending = r" />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>

    <ConfirmActionDialog
      :open="pending !== null"
      title="Supprimer définitivement ce compte"
      :message="`Le compte de ${pendingName} sera anonymisé et banni. Cette action est irréversible.`"
      confirm-label="Supprimer définitivement"
      :require-reason="true"
      :confirmation-phrase="pendingName"
      :confirmation-label="`Saisissez « ${pendingName} » pour confirmer`"
      @confirm="confirmExecute"
      @cancel="pending = null"
    />
  </div>
</template>
