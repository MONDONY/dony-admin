import { ref, reactive } from 'vue'
import { adminAccountsService } from '@/features/admin-accounts/services/adminAccountsService'
import type { AdminAccount, TemporaryCredentials, ManagedAdminRole, AdminStatus } from '@/features/admin-accounts/types/index'

export function useAdminAccounts() {
  const accounts = ref<AdminAccount[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
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
      error.value = (e as Error).message
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

  function clearTemporaryCredentials() {
    temporaryCredentials.value = null
  }

  return {
    accounts,
    loading,
    error,
    temporaryCredentials,
    pagination,
    fetchAccounts,
    createAccount,
    setRole,
    setStatus,
    resetPassword,
    clearTemporaryCredentials,
  }
}
