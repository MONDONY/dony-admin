<script setup lang="ts">
import { onMounted } from 'vue'
import UserFilters from '@/features/users/components/UserFilters.vue'
import UserTable from '@/features/users/components/UserTable.vue'
import UserDetailPanel from '@/features/users/components/UserDetailPanel.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useUsers } from '@/features/users/composables/useUsers'
import { useUserDetail } from '@/features/users/composables/useUserDetail'

definePageMeta({ middleware: 'admin-only', permission: 'USER_VIEW', pageTitle: 'Utilisateurs', pageSubtitle: 'Recherche & modération des comptes' })

const { users, isLoading, totalPages, currentPage, filters, fetchUsers, goToPage, setStatusFilter, setSearch } = useUsers()
const detail = useUserDetail()

async function openUser(id: string) { await detail.open(id) }
async function afterAction() { await fetchUsers() }

onMounted(fetchUsers)
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
      @close="detail.close"
      @suspend="async (r) => { await detail.suspend(r); await afterAction() }"
      @ban="async (r) => { await detail.ban(r); await afterAction() }"
      @unsuspend="async () => { await detail.unsuspend(); await afterAction() }"
    />
  </div>
</template>
