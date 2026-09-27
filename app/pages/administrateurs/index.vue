<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AdminAccountsTable from '@/features/admin-accounts/components/AdminAccountsTable.vue'
import CreateAdminDialog from '@/features/admin-accounts/components/CreateAdminDialog.vue'
import TemporaryCredentialsDialog from '@/features/admin-accounts/components/TemporaryCredentialsDialog.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useAdminAccounts, adminAccountErrorMessage } from '@/features/admin-accounts/composables/useAdminAccounts'
import { useAuthStore } from '@/stores/auth'
import type { AdminAccount, ManagedAdminRole, AdminStatus } from '@/features/admin-accounts/types/index'

definePageMeta({
  middleware: 'admin-only',
  permission: 'ADMIN_MANAGE',
  pageTitle: 'Administrateurs',
  pageSubtitle: 'Comptes et accès au back-office',
})

const {
  accounts, loading, error, actionError, temporaryCredentials, pagination,
  fetchAccounts, createAccount, setRole, setStatus, resetPassword, deleteAccount, clearTemporaryCredentials,
} = useAdminAccounts()
const auth = useAuthStore()

const showCreate = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)

type PendingAction =
  | { kind: 'role'; id: string; role: ManagedAdminRole }
  | { kind: 'status'; id: string; status: AdminStatus }
  | { kind: 'reset'; id: string }
  | { kind: 'delete'; id: string; email: string }

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
  delete: {
    title: 'Supprimer ce compte administrateur',
    message: 'Le compte sera désactivé et ses sessions révoquées. Il disparaîtra de la liste et ne pourra plus se connecter au back-office.',
    confirmLabel: 'Supprimer',
  },
}

// Double confirmation sur la suppression : l'email exact du compte visé doit être ressaisi.
const deletePhrase = computed(() => (pending.value?.kind === 'delete' ? pending.value.email : undefined))

function requestRole(id: string, role: ManagedAdminRole) {
  pending.value = { kind: 'role', id, role }
}
function requestStatus(id: string, status: AdminStatus) {
  pending.value = { kind: 'status', id, status }
}
function requestReset(id: string) {
  pending.value = { kind: 'reset', id }
}
function requestDelete(account: AdminAccount) {
  pending.value = { kind: 'delete', id: account.id, email: account.email }
}

async function confirmPending() {
  const action = pending.value
  if (!action) return
  pending.value = null
  if (action.kind === 'delete') {
    await deleteAccount(action.id)
    return
  }
  actionError.value = null
  try {
    if (action.kind === 'role') await setRole(action.id, action.role)
    else if (action.kind === 'status') await setStatus(action.id, action.status)
    else await resetPassword(action.id)
  } catch (e) {
    actionError.value = adminAccountErrorMessage(e, 'L’action a échoué')
  }
}

async function onCreate(email: string, role: ManagedAdminRole) {
  if (creating.value) return
  creating.value = true
  createError.value = null
  try {
    await createAccount(email, role)
    showCreate.value = false
  } catch (e) {
    createError.value = adminAccountErrorMessage(e, 'La création a échoué')
  } finally {
    creating.value = false
  }
}

function onCreateCancel() {
  showCreate.value = false
  createError.value = null
}

function openCreate() {
  createError.value = null
  showCreate.value = true
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
        @click="openCreate"
      >Nouvel administrateur</button>
    </div>

    <p
      v-if="error || actionError" data-test="admins-error" role="alert"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ actionError ?? error }}</p>

    <AdminAccountsTable
      :accounts="accounts" :loading="loading" :current-admin-id="auth.user?.id ?? null"
      @role="requestRole" @status="requestStatus" @reset="requestReset" @delete="requestDelete"
    />

    <div class="mt-4">
      <PaginationControls :page="pagination.currentPage" :total-pages="pagination.totalPages" @change="onPageChange" />
    </div>

    <CreateAdminDialog
      v-if="showCreate" :pending="creating" :error="createError"
      @submit="onCreate" @cancel="onCreateCancel"
    />

    <TemporaryCredentialsDialog
      v-if="temporaryCredentials" :credentials="temporaryCredentials"
      @close="onCredentialsClose"
    />

    <ConfirmActionDialog
      :open="pending !== null"
      :title="pending ? confirmCopy[pending.kind].title : ''"
      :message="pending ? confirmCopy[pending.kind].message : ''"
      :confirm-label="pending ? confirmCopy[pending.kind].confirmLabel : ''"
      :confirmation-phrase="deletePhrase"
      :confirmation-label="deletePhrase ? `Saisissez l’email « ${deletePhrase} » pour confirmer` : undefined"
      @confirm="confirmPending"
      @cancel="pending = null"
    />
  </div>
</template>
