import { reactive, ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import type { AdminUserListItem, UsersFilterState, UserStatusFilter } from '@/features/users/types/index'

export function useUsers() {
  const users = ref<AdminUserListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalElements = ref(0)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<UsersFilterState>({
    status: 'TOUS', role: null, kyc: null, pro: null, city: null, query: '',
  })

  async function fetchUsers() {
    isLoading.value = true
    error.value = null
    try {
      const page = await usersService.list(filters, currentPage.value, pageSize.value)
      users.value = page.content
      totalElements.value = page.totalElements
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) { currentPage.value = p; await fetchUsers() }
  async function setStatusFilter(s: UserStatusFilter) { filters.status = s; currentPage.value = 0; await fetchUsers() }
  async function setSearch(q: string) { filters.query = q; currentPage.value = 0; await fetchUsers() }

  return { users, isLoading, error, totalElements, totalPages, currentPage, pageSize, filters, fetchUsers, goToPage, setStatusFilter, setSearch }
}
