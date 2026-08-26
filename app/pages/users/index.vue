<script setup lang="ts">
import { ref, onMounted } from 'vue'
import UserFilters from '@/features/users/components/UserFilters.vue'
import UserTable from '@/features/users/components/UserTable.vue'
import UserDetailPanel from '@/features/users/components/UserDetailPanel.vue'
import UserDeletionDialog from '@/features/users/components/UserDeletionDialog.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useUsers } from '@/features/users/composables/useUsers'
import { useUserDetail } from '@/features/users/composables/useUserDetail'
import { useUserKyc } from '@/features/users/composables/useUserKyc'
import { useUserDeletion } from '@/features/users/composables/useUserDeletion'
import type { AdminDeletionReasonCode } from '@/features/users/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'USER_VIEW', pageTitle: 'Utilisateurs', pageSubtitle: 'Recherche & modération des comptes' })

const route = useRoute()
const { users, isLoading, totalPages, currentPage, filters, fetchUsers, goToPage, setStatusFilter, setSearch } = useUsers()
const detail = useUserDetail()
const kyc = useUserKyc()
const deletion = useUserDeletion()
const deletionOpen = ref(false)

async function openUser(id: string) { await detail.open(id) }
async function afterAction() { await fetchUsers() }

async function openDeletion() {
  if (!detail.user.value) return
  deletionOpen.value = true
  await deletion.loadImpact(detail.user.value.id)
}

function closeDeletion() {
  deletionOpen.value = false
  deletion.reset()
}

async function confirmDeletion(reasonCode: AdminDeletionReasonCode, reason: string) {
  if (!detail.user.value) return
  const id = detail.user.value.id
  const ok = await deletion.remove(id, reasonCode, reason)
  // On ne ferme qu'en cas de succès : sur un refus, l'erreur doit rester lisible
  // à l'écran plutôt que de disparaître avec le dialogue.
  if (!ok) return
  closeDeletion()
  detail.close()
  await fetchUsers()
}

onMounted(async () => {
  // Constat 1 — initialise le filtre de recherche depuis le paramètre d'URL ?query=<uuid>
  // afin que les liens de contreparties dans UserDeletionDialog ouvrent la liste filtrée.
  const q = route.query.query
  if (q && typeof q === 'string') {
    await setSearch(q)
  } else {
    await fetchUsers()
  }
})
</script>

<template>
  <div>
    <UserFilters
      :model-status="filters.status" :model-query="filters.query"
      @update:status="setStatusFilter" @update:query="setSearch"
    />
    <UserTable :users="users" :loading="isLoading" @select="openUser" />
    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>

    <UserDetailPanel
      v-if="detail.user.value"
      :user="detail.user.value" :open="detail.user.value !== null"
      :error="detail.error.value" :busy="detail.busy.value"
      :kyc="kyc.kyc.value" :kyc-loading="kyc.isLoading.value" :kyc-error="kyc.error.value"
      @close="detail.close"
      @suspend="async (r) => { await detail.suspend(r); await afterAction() }"
      @ban="async (r) => { await detail.ban(r); await afterAction() }"
      @unsuspend="async () => { await detail.unsuspend(); await afterAction() }"
      @suspend-publishing="async (r) => { await detail.suspendPublishing(r); await afterAction() }"
      @lift-publishing="async () => { await detail.liftPublishing(); await afterAction() }"
      @set-commission="async (rate) => { await detail.setCommissionRate(rate); await afterAction() }"
      @mute-messaging="async (durationHours, reason) => { await detail.muteMessaging(durationHours, reason); await afterAction() }"
      @unmute-messaging="async () => { await detail.unmuteMessaging(); await afterAction() }"
      @open-kyc="() => kyc.load(detail.user.value!.id)"
      @reset-kyc="async (reason) => { const id = detail.user.value!.id; await kyc.reset(id, reason); await detail.open(id); await afterAction() }"
      @request-delete="openDeletion"
    />

    <UserDeletionDialog
      v-if="detail.user.value"
      :open="deletionOpen"
      :user="detail.user.value"
      :impact="deletion.impact.value"
      :is-loading="deletion.isLoading.value"
      :busy="deletion.busy.value"
      :error="deletion.error.value"
      @confirm="confirmDeletion"
      @cancel="closeDeletion"
    />
  </div>
</template>
