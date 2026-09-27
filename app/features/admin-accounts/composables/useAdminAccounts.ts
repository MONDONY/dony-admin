import { ref, reactive } from 'vue'
import { adminAccountsService } from '@/features/admin-accounts/services/adminAccountsService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminAccount, TemporaryCredentials, ManagedAdminRole, AdminStatus } from '@/features/admin-accounts/types/index'

/**
 * Les refus du back sur les comptes admin sont rédigés en anglais : les codes connus sont
 * traduits, les autres gardent le `detail` du ProblemDetail.
 */
const ERROR_MESSAGES: Record<string, string> = {
  ADMIN_SELF_DELETE: 'Vous ne pouvez pas supprimer votre propre compte.',
  ADMIN_SUPER_ADMIN_IMMUTABLE: 'Le compte super-administrateur ne peut être ni modifié ni supprimé.',
}

export function adminAccountErrorMessage(e: unknown, fallback: string): string {
  const code = (e as { data?: { code?: string } } | undefined)?.data?.code
  return (code && ERROR_MESSAGES[code]) || extractProblemMessage(e, fallback)
}

export function useAdminAccounts() {
  const accounts = ref<AdminAccount[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const actionError = ref<string | null>(null)
  const temporaryCredentials = ref<TemporaryCredentials | null>(null)

  const pagination = reactive({
    totalElements: 0,
    totalPages: 0,
    currentPage: 0,
    pageSize: 20,
  })

  async function fetchAccounts() {
    loading.value = true
    error.value = null
    try {
      const page = await adminAccountsService.list(pagination.currentPage, pagination.pageSize)
      accounts.value = page.content
      pagination.totalElements = page.totalElements
      pagination.totalPages = page.totalPages
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les administrateurs')
    } finally {
      loading.value = false
    }
  }

  async function createAccount(email: string, role: ManagedAdminRole) {
    temporaryCredentials.value = await adminAccountsService.create(email, role)
    await fetchAccounts()
  }

  async function setRole(id: string, role: ManagedAdminRole) {
    await adminAccountsService.update(id, { role })
    await fetchAccounts()
  }

  async function setStatus(id: string, status: AdminStatus) {
    await adminAccountsService.update(id, { status })
    await fetchAccounts()
  }

  async function resetPassword(id: string) {
    temporaryCredentials.value = await adminAccountsService.resetPassword(id)
    await fetchAccounts()
  }

  /** Retourne true si la suppression a abouti ; sinon `actionError` porte le motif du refus. */
  async function deleteAccount(id: string): Promise<boolean> {
    actionError.value = null
    try {
      await adminAccountsService.remove(id)
    } catch (e) {
      actionError.value = adminAccountErrorMessage(e, 'La suppression a échoué')
      return false
    }
    await fetchAccounts()
    return true
  }

  function clearTemporaryCredentials() {
    temporaryCredentials.value = null
  }

  return {
    accounts,
    loading,
    error,
    actionError,
    temporaryCredentials,
    pagination,
    fetchAccounts,
    createAccount,
    setRole,
    setStatus,
    resetPassword,
    deleteAccount,
    clearTemporaryCredentials,
  }
}
