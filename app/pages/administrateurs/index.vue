<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminAccountsTable from '@/features/admin-accounts/components/AdminAccountsTable.vue'
import CreateAdminDialog from '@/features/admin-accounts/components/CreateAdminDialog.vue'
import TemporaryCredentialsDialog from '@/features/admin-accounts/components/TemporaryCredentialsDialog.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useAdminAccounts } from '@/features/admin-accounts/composables/useAdminAccounts'
import type { ManagedAdminRole, AdminStatus } from '@/features/admin-accounts/types/index'

definePageMeta({
  middleware: ['admin-only', 'super-admin-only'],
  pageTitle: 'Administrateurs',
  pageSubtitle: 'Comptes et accès au back-office',
})

const {
  accounts, loading, temporaryCredentials, pagination,
  fetchAccounts, createAccount, setRole, setStatus, resetPassword, clearTemporaryCredentials,
} = useAdminAccounts()

const showCreate = ref(false)

type PendingAction =
  | { kind: 'role'; id: string; role: ManagedAdminRole }
  | { kind: 'status'; id: string; status: AdminStatus }
  | { kind: 'reset'; id: string }

const pending = ref<PendingAction | null>(null)

const confirmCopy: Record<PendingAction['kind'], { title: string; message: string; confirmLabel: string }> = {
  role: {
    title: 'Changer le rôle',
    message: 'Le nouvel accès sera appliqué immédiatement à ce compte.',
    confirmLabel: 'Confirmer',
  },
  status: {
    title: 'Changer le statut',
    message: 'Ce compte pourra ou non se connecter au back-office selon le nouveau statut.',
    confirmLabel: 'Confirmer',
  },
  reset: {
    title: 'Réinitialiser le mot de passe',
    message: 'Un mot de passe temporaire sera généré et l’ancien deviendra invalide.',
    confirmLabel: 'Réinitialiser',
  },
}

function requestRole(id: string, role: ManagedAdminRole) {
  pending.value = { kind: 'role', id, role }
}
function requestStatus(id: string, status: AdminStatus) {
  pending.value = { kind: 'status', id, status }
}
function requestReset(id: string) {
  pending.value = { kind: 'reset', id }
}

async function confirmPending() {
  const action = pending.value
  if (!action) return
  if (action.kind === 'role') await setRole(action.id, action.role)
  else if (action.kind === 'status') await setStatus(action.id, action.status)
  else await resetPassword(action.id)
  pending.value = null
}

async function onCreate(email: string, role: ManagedAdminRole) {
  await createAccount(email, role)
  showCreate.value = false
}

function onCredentialsClose() {
  clearTemporaryCredentials()
}

function onPageChange(page: number) {
  pagination.currentPage = page
  fetchAccounts()
}

onMounted(fetchAccounts)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-text-muted tabular-nums">{{ pagination.totalElements }} administrateur(s)</p>
      <button
        type="button" data-test="new-admin"
        class="rounded-btn px-4 py-2 text-sm bg-primary text-white hover:bg-primary/90"
        @click="showCreate = true"
      >Nouvel administrateur</button>
    </div>

    <AdminAccountsTable
      :accounts="accounts" :loading="loading"
      @role="requestRole" @status="requestStatus" @reset="requestReset"
    />

    <div class="mt-4">
      <PaginationControls :page="pagination.currentPage" :total-pages="pagination.totalPages" @change="onPageChange" />
    </div>

    <CreateAdminDialog v-if="showCreate" @submit="onCreate" @cancel="showCreate = false" />

    <TemporaryCredentialsDialog
      v-if="temporaryCredentials" :credentials="temporaryCredentials"
      @close="onCredentialsClose"
    />

    <ConfirmActionDialog
      :open="pending !== null"
      :title="pending ? confirmCopy[pending.kind].title : ''"
      :message="pending ? confirmCopy[pending.kind].message : ''"
      :confirm-label="pending ? confirmCopy[pending.kind].confirmLabel : ''"
      @confirm="confirmPending"
      @cancel="pending = null"
    />
  </div>
</template>
